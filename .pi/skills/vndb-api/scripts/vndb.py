#!/usr/bin/env python3
"""VNDB (vndb.org) Kana HTTP API client.

Zero dependencies (stdlib only). Covers every public endpoint of
https://api.vndb.org/kana :

  Read (no auth)   : vn, release, producer, character, staff, tag, trait, quote
  Read (GET)       : user, stats, schema, ulist_labels
  Read (auth)      : authinfo, ulist (private labels), rlist
  Write (auth)     : set, unset, rset, runset   <- require `listwrite` + --yes

Auth token resolution order:
  --token  >  $VNDB_TOKEN  >  ~/.config/vndb/token  >  ~/.vndb_token

Get a token at https://vndb.org/u/tokens

Examples:
  vndb.py get v17 v11
  vndb.py vn -f 'rating>=80' -f 'olang=ja' -s rating -r -n 5 -F 'id,title,rating'
  vndb.py vn --filter-json '["and",["tag","=",[105,1,0]],["released",">=","2020"]]' -F title
  vndb.py ulist -u u2 -F 'id,vote,labels{id,label},vn{title}' -s vote -r
  vndb.py labels -u u2
  vndb.py set v17 --vote 90 --labels-set 2 --yes
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

DEFAULT_API = "https://api.vndb.org/kana"
DEFAULT_TIMEOUT = 30.0

QUERY_ENDPOINTS = ["vn", "release", "producer", "character", "staff", "tag", "trait", "quote"]

# vndbid prefix -> endpoint, used by the `get` subcommand.
PREFIX_ENDPOINT = {
    "v": "vn",
    "r": "release",
    "p": "producer",
    "c": "character",
    "s": "staff",
    "g": "tag",
    "i": "trait",
    "q": "quote",
}

# Small, safe default field sets for `get` (avoids "Too much data selected").
DEFAULT_FIELDS = {
    "vn": "id,title,alttitle,released,rating,votecount,image.url",
    "release": "id,title,released,platforms,languages.lang",
    "producer": "id,name,original,type,lang",
    "character": "id,name,original,image.url",
    "staff": "id,name,original,gender",
    "tag": "id,name,category,vn_count",
    "trait": "id,name,group_name,char_count",
    "quote": "id,quote,score",
}

RATE_LIMIT_NOTE = (
    "VNDB rate limits: 200 requests / 5 min, max 3s CPU time per request. "
    "Batch ids in one call (<=100) instead of looping."
)


# --------------------------------------------------------------------------
# HTTP layer
# --------------------------------------------------------------------------

class VndbError(Exception):
    """An error returned by the VNDB API (or a transport failure)."""

    def __init__(self, message, status=None, body=None):
        super().__init__(message)
        self.status = status
        self.body = body


def resolve_token(explicit=None):
    """Find an API token from flag, env var, or config file."""
    if explicit:
        return explicit.strip()
    env = os.environ.get("VNDB_TOKEN")
    if env and env.strip():
        return env.strip()
    for path in (
        os.path.join(os.path.expanduser("~"), ".config", "vndb", "token"),
        os.path.join(os.path.expanduser("~"), ".vndb_token"),
    ):
        try:
            with open(path, "r", encoding="utf-8") as fh:
                tok = fh.read().strip()
            if tok:
                return tok
        except OSError:
            continue
    return None


def request(method, path, body=None, token=None, query=None, timeout=DEFAULT_TIMEOUT,
            api_base=DEFAULT_API):
    """Perform one API call. Returns parsed JSON, or None for 204 responses."""
    url = api_base.rstrip("/") + path
    if query:
        clean = {k: v for k, v in query.items() if v is not None}
        if clean:
            url += "?" + urllib.parse.urlencode(clean, doseq=True)

    data = None
    headers = {"Accept": "application/json"}
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = "Token " + token

    req = urllib.request.Request(url, data=data, headers=headers, method=method.upper())
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            if not raw:
                return None
            return json.loads(raw.decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", "replace")
        detail = raw
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                detail = parsed.get("message") or raw
        except (ValueError, TypeError):
            pass
        hint = ""
        if exc.code == 401:
            hint = " (invalid token - create one at https://vndb.org/u/tokens)"
        elif exc.code == 429:
            hint = " (rate limited: 200 requests / 5 minutes)"
        elif exc.code == 400:
            hint = " (invalid request body or query)"
        raise VndbError(f"HTTP {exc.code}: {detail}{hint}", status=exc.code, body=raw) from exc
    except urllib.error.URLError as exc:
        raise VndbError(f"network error: {exc.reason}") from exc
    except TimeoutError as exc:
        raise VndbError(f"request timed out after {timeout}s") from exc


# --------------------------------------------------------------------------
# Filter parsing
# --------------------------------------------------------------------------

OPERATORS = ("!=", ">=", "<=", "=", ">", "<")


def parse_value(raw):
    """Parse a filter value as JSON when possible, else treat it as a string.

    VNDB coerces between string/int for most comparisons, so this is a
    convenience rather than a strict requirement.
    """
    try:
        return json.loads(raw)
    except (ValueError, TypeError):
        return raw


def parse_filter_expr(expr):
    """Turn 'rating>=80' into ['rating', '>=', 80].

    Also accepts:
      * a full JSON predicate, e.g. '["id","=","v17"]'
      * dotted names for NESTED filters, e.g. 'vn.id=v17' and
        'vn.released>=2000', which expand to ['vn','=',['id','=','v17']]
        and ['vn','=',['released','>=',2000]].

    Nested filters (vn, release, character, staff, developer, producer, seiyuu)
    take another predicate as their value, NOT a plain scalar. Writing
    'vn=v17' is invalid; the dotted form exists to make that hard to get wrong.
    The outer operator is always '=' for dotted names - use --filter-json if a
    different outer operator is ever needed.
    """
    text = expr.strip()
    if text.startswith("[") or text.startswith("{"):
        parsed = json.loads(text)
        if isinstance(parsed, (list, dict)):
            return parsed
        raise ValueError(f"not a valid predicate: {expr!r}")
    for op in OPERATORS:
        idx = text.find(op)
        if idx > 0:
            name = text[:idx].strip()
            value = text[idx + len(op):].strip()
            if not name:
                raise ValueError(f"missing filter name in {expr!r}")
            if "." in name:
                outer, inner = (part.strip() for part in name.split(".", 1))
                if not outer or not inner:
                    raise ValueError(f"malformed nested filter name in {expr!r}")
                return [outer, "=", [inner, op, parse_value(value)]]
            return [name, op, parse_value(value)]
    raise ValueError(
        f"cannot parse filter {expr!r}; expected NAME OP VALUE, e.g. 'rating>=80' "
        f"or 'vn.id=v17'"
    )


def build_filters(args):
    """Combine --filter / --filter-json / --filters-json into one filters value."""
    predicates = []

    if getattr(args, "filters_json", None):
        parsed = json.loads(args.filters_json)
        if isinstance(parsed, list) and parsed and parsed[0] in ("and", "or"):
            predicates.append(parsed)
        else:
            predicates.append(parsed)

    for expr in getattr(args, "filter", None) or []:
        predicates.append(parse_filter_expr(expr))

    for expr in getattr(args, "filter_json", None) or []:
        predicates.append(json.loads(expr))

    if not predicates:
        return []
    if len(predicates) == 1:
        return predicates[0]
    return ["and"] + predicates


# --------------------------------------------------------------------------
# Query execution
# --------------------------------------------------------------------------

def run_query(args, endpoint):
    """Execute a POST query against one of the database endpoints."""
    if args.body:
        body = read_body(args.body)
    else:
        body = {
            "filters": build_filters(args),
            "fields": args.fields or "",
            "sort": args.sort or "id",
            "reverse": bool(args.reverse),
            "results": args.results,
            "page": args.page,
        }
        if args.user:
            body["user"] = args.user
        if args.count:
            body["count"] = True
        if args.compact_filters:
            body["compact_filters"] = True
        if args.normalized_filters:
            body["normalized_filters"] = True

    if not args.all:
        return request("POST", "/" + endpoint, body=body, token=resolve_token(args.token),
                       api_base=args.api_base, timeout=args.timeout)

    return paginate(args, endpoint, body)


def paginate(args, endpoint, body):
    """Walk every page and merge the results.

    Uses an `id > last` cursor when sorting by id (the default and the only
    fully reliable cursor), otherwise falls back to the `page` parameter.
    """
    merged = []
    count = None
    page = 1
    page_size = body.get("results") or 10
    use_cursor = (body.get("sort") or "id") == "id"
    token = resolve_token(args.token)

    while True:
        if use_cursor:
            cursor_body = dict(body)
            cursor_body["filters"] = add_id_cursor(body.get("filters") or [], merged)
            cursor_body.pop("page", None)
        else:
            cursor_body = dict(body)
            cursor_body["page"] = page

        payload = request("POST", "/" + endpoint, body=cursor_body, token=token,
                          api_base=args.api_base, timeout=args.timeout)
        results = payload.get("results") or []
        merged.extend(results)
        if count is None and payload.get("count") is not None:
            count = payload["count"]

        if not payload.get("more") or not results:
            break
        if len(merged) >= args.max_results:
            break

        page += 1
        if args.max_pages and page > args.max_pages:
            break
        time.sleep(args.delay)

    if len(merged) > args.max_results:
        merged = merged[: args.max_results]

    out = {"results": merged, "more": False, "truncated_by_limit": True} \
        if len(merged) >= args.max_results else {"results": merged, "more": False}
    if count is not None:
        out["count"] = count
    return out


def add_id_cursor(filters, already):
    """Append an `id > <last id>` predicate for cursor-based pagination."""
    if not already:
        return filters
    last_id = already[-1].get("id")
    if last_id is None:
        return filters
    cursor = ["id", ">", last_id]
    if not filters:
        return cursor
    if isinstance(filters, list) and filters and filters[0] == "and":
        return filters + [cursor]
    return ["and", filters, cursor]


def read_body(spec):
    """Read a full JSON query body from a file or stdin ('-')."""
    if spec == "-":
        return json.load(sys.stdin)
    with open(spec, "r", encoding="utf-8") as fh:
        return json.load(fh)


# --------------------------------------------------------------------------
# `get` subcommand - batch lookup by vndbid
# --------------------------------------------------------------------------

def cmd_get(args):
    ids = []
    for token in args.ids:
        for part in token.replace(",", " ").split():
            if part:
                ids.append(part)
    if not ids:
        raise VndbError("no ids given")
    if len(ids) > 100:
        raise VndbError(
            f"{len(ids)} ids given; the API allows at most 100 predicates per request. "
            "Split into chunks of 100."
        )

    endpoints = {PREFIX_ENDPOINT.get(prefix_of(i)) for i in ids}
    if len(endpoints) > 1 or None in endpoints:
        raise VndbError(
            f"ids span multiple types or have an unknown prefix: {sorted(ids)}. "
            "Pass ids of a single type (v/r/p/c/s/g/i/q), one call per type."
        )
    endpoint = endpoints.pop()

    predicates = [["id", "=", i] for i in ids]
    filters = predicates[0] if len(predicates) == 1 else ["or"] + predicates
    fields = args.fields or DEFAULT_FIELDS.get(endpoint, "id")

    body = {
        "filters": filters,
        "fields": fields,
        "results": min(100, len(ids)),
        "sort": "id",
    }
    payload = request("POST", "/" + endpoint, body=body, token=resolve_token(args.token),
                      api_base=args.api_base, timeout=args.timeout)

    results = payload.get("results") or []
    found = {r.get("id") for r in results}
    missing = [i for i in ids if i not in found]
    if missing:
        payload["not_found"] = missing
    return payload


def prefix_of(vndbid):
    """Extract the alphabetic prefix of a vndbid ('v17' -> 'v')."""
    text = str(vndbid)
    while text and text[-1].isdigit():
        text = text[:-1]
    return text


# --------------------------------------------------------------------------
# Write operations
# --------------------------------------------------------------------------

def write_guard(args, method, path, body):
    """Show the planned write; only execute with --yes."""
    if not args.yes:
        planned = {"method": method, "path": path, "body": body}
        print(json.dumps({"dry_run": True, "request": planned,
                          "hint": "re-run with --yes to actually apply this change"},
                         indent=2, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(3)
    token = resolve_token(args.token)
    if not token:
        raise VndbError(
            "write operations require an API token with the `listwrite` permission. "
            "Set $VNDB_TOKEN or pass --token (create one at https://vndb.org/u/tokens)."
        )
    result = request(method, path, body=body, token=token, api_base=args.api_base,
                     timeout=args.timeout)
    return {"ok": True, "method": method, "path": path, "response": result}


def cmd_set(args):
    target = args.target
    body = {}
    if args.vote is not None:
        if not 10 <= args.vote <= 100:
            raise VndbError("--vote must be between 10 and 100")
        body["vote"] = args.vote
    if args.notes is not None:
        body["notes"] = args.notes
    if args.started is not None:
        body["started"] = args.started
    if args.finished is not None:
        body["finished"] = args.finished
    if args.labels is not None:
        body["labels"] = parse_id_list(args.labels)
    if args.labels_set is not None:
        body["labels_set"] = parse_id_list(args.labels_set)
    if args.labels_unset is not None:
        body["labels_unset"] = parse_id_list(args.labels_unset)
    for field in args.null or []:
        body[field] = None

    if not body:
        raise VndbError("nothing to change; pass --vote/--notes/--started/--finished/"
                        "--labels/--labels-set/--labels-unset/--null")
    return write_guard(args, "PATCH", "/ulist/" + target, body)


def cmd_rlist_read_hint(args):
    """VNDB has no read endpoint for release lists - steer to the right one."""
    raise VndbError(
        "VNDB exposes no read endpoint for release lists (POST/GET /rlist both "
        "return 404). Only PATCH/DELETE /rlist/<id> exist.\n"
        "Read release-list data through /ulist and its `releases` field instead:\n"
        "  vndb.py ulist -u u2 -F 'id,vn{title},releases{id,title,list_status}'\n"
        "list_status: 0=Unknown 1=Pending 2=Obtained 3=On loan 4=Deleted\n"
        "To change a release status, use `rset`/`runset`."
    )


def cmd_unset(args):
    return write_guard(args, "DELETE", "/ulist/" + args.target, None)


def cmd_rset(args):
    body = {}
    if args.status is not None:
        if not 0 <= args.status <= 4:
            raise VndbError("--status must be 0-4 (0 Unknown, 1 Pending, 2 Obtained, "
                            "3 On loan, 4 Deleted)")
        body["status"] = args.status
    if not body:
        raise VndbError("nothing to change; pass --status")
    return write_guard(args, "PATCH", "/rlist/" + args.target, body)


def cmd_runset(args):
    return write_guard(args, "DELETE", "/rlist/" + args.target, None)


def parse_id_list(text):
    """Accept '2', '2,5,9' or '[2,5,9]' and return a list of ints."""
    stripped = text.strip()
    if stripped.startswith("["):
        parsed = json.loads(stripped)
        return [int(x) for x in parsed]
    return [int(x) for x in stripped.replace(",", " ").split() if x.strip()]


# --------------------------------------------------------------------------
# Simple GET endpoints
# --------------------------------------------------------------------------

def cmd_user(args):
    if not args.query:
        raise VndbError("`user` needs at least one -q/--query (user id or username)")
    return request("GET", "/user", query={"q": args.query, "fields": args.fields},
                   token=resolve_token(args.token), api_base=args.api_base,
                   timeout=args.timeout)


def cmd_labels(args):
    return request("GET", "/ulist_labels",
                   query={"user": args.user, "fields": args.fields},
                   token=resolve_token(args.token), api_base=args.api_base,
                   timeout=args.timeout)


def cmd_stats(args):
    return request("GET", "/stats", api_base=args.api_base, timeout=args.timeout)


def cmd_authinfo(args):
    token = resolve_token(args.token)
    if not token:
        raise VndbError("no token found (--token, $VNDB_TOKEN, or ~/.config/vndb/token)")
    return request("GET", "/authinfo", token=token, api_base=args.api_base,
                   timeout=args.timeout)


def cmd_schema(args):
    schema = request("GET", "/schema", api_base=args.api_base, timeout=args.timeout)
    if args.section == "enums":
        schema = schema.get("enums", {})
        if args.name:
            schema = schema.get(args.name, {})
    elif args.section == "extlinks":
        ext = schema.get("extlinks", {})
        schema = ext.get("/" + args.name, ext) if args.name else ext
    elif args.section == "fields":
        fields = schema.get("api_fields", {})
        if args.name:
            fields = fields.get("/" + args.name.lstrip("/"), {})
        schema = fields
    for key in args.key or []:
        schema = schema.get(key, {})
    return schema


# --------------------------------------------------------------------------
# CLI wiring
# --------------------------------------------------------------------------

class _Parser(argparse.ArgumentParser):
    """ArgumentParser that raises instead of printing usage on error."""

    def error(self, message):
        raise VndbError(message)


def add_common(parser, with_query=True):
    parser.add_argument("--token", help="API token (else $VNDB_TOKEN / ~/.config/vndb/token)")
    parser.add_argument("--api-base", default=os.environ.get("VNDB_API_BASE", DEFAULT_API),
                        help=f"API base URL (default {DEFAULT_API})")
    parser.add_argument("--timeout", type=float, default=DEFAULT_TIMEOUT,
                        help=f"HTTP timeout in seconds (default {DEFAULT_TIMEOUT})")
    parser.add_argument("--compact", action="store_true", help="single-line JSON output")
    if with_query:
        parser.add_argument("-f", "--filter", action="append", metavar="EXPR",
                            help="filter as NAME OP VALUE, e.g. 'rating>=80' (repeatable, ANDed)")
        parser.add_argument("--filter-json", action="append", metavar="JSON",
                            help="raw JSON predicate array (repeatable)")
        parser.add_argument("--filters-json", metavar="JSON",
                            help="entire filters value as JSON (overrides the above)")
        parser.add_argument("-F", "--fields", help="comma-separated field list, supports image.url and labels{id,label}")
        parser.add_argument("-s", "--sort", help="sort field (endpoint-specific, default id)")
        parser.add_argument("-r", "--reverse", action="store_true", help="descending order")
        parser.add_argument("-n", "--results", type=int, default=10, help="results per page, max 100 (default 10)")
        parser.add_argument("-p", "--page", type=int, default=1, help="page number (default 1)")
        parser.add_argument("-u", "--user", help="user id, e.g. u2 (required for /ulist unless authenticated)")
        parser.add_argument("--count", action="store_true", help="also return total match count (slow)")
        parser.add_argument("--compact-filters", action="store_true", help="also return compact filter string")
        parser.add_argument("--normalized-filters", action="store_true", help="also return normalized filters")
        parser.add_argument("--body", help="read the full JSON query body from this file ('-' for stdin)")
        parser.add_argument("--all", action="store_true", help="auto-paginate and merge all results")
        parser.add_argument("--max-results", type=int, default=1000, help="cap for --all (default 1000)")
        parser.add_argument("--max-pages", type=int, default=200, help="page cap for --all (default 200)")
        parser.add_argument("--delay", type=float, default=0.35, help="seconds between pages for --all")


def build_parser():
    parser = _Parser(
        prog="vndb.py",
        description="VNDB Kana API client - every public endpoint.",
        epilog=RATE_LIMIT_NOTE,
    )
    sub = parser.add_subparsers(dest="command", metavar="COMMAND")

    for endpoint in QUERY_ENDPOINTS:
        p = sub.add_parser(endpoint, help=f"query /{endpoint}")
        add_common(p)
        p.set_defaults(func=lambda a, ep=endpoint: run_query(a, ep))

    p = sub.add_parser("get", help="fetch entries by vndbid (batched, single type)")
    add_common(p, with_query=False)
    p.add_argument("ids", nargs="+", help="one or more vndbids, e.g. v17 v11")
    p.add_argument("-F", "--fields", help="comma-separated field list")
    p.set_defaults(func=cmd_get)

    p = sub.add_parser("ulist", help="read a user's visual novel list")
    add_common(p)
    p.set_defaults(func=lambda a: run_query(a, "ulist"))

    p = sub.add_parser("rlist", help="explains how to read release lists (no read endpoint exists)")
    add_common(p, with_query=False)
    p.set_defaults(func=cmd_rlist_read_hint)

    p = sub.add_parser("labels", help="list a user's list labels (/ulist_labels)")
    add_common(p, with_query=False)
    p.add_argument("-u", "--user", help="user id (defaults to the authenticated user)")
    p.add_argument("-F", "--fields", help="currently only 'count' is supported")
    p.set_defaults(func=cmd_labels)

    p = sub.add_parser("user", help="look up users by id or username")
    add_common(p, with_query=False)
    p.add_argument("-q", "--query", action="append", help="user id or username (repeatable)")
    p.add_argument("-F", "--fields", help="fields to select (id/username always returned)")
    p.set_defaults(func=cmd_user)

    p = sub.add_parser("stats", help="database-wide counts")
    add_common(p, with_query=False)
    p.set_defaults(func=cmd_stats)

    p = sub.add_parser("authinfo", help="verify the token and show its permissions")
    add_common(p, with_query=False)
    p.set_defaults(func=cmd_authinfo)

    p = sub.add_parser("schema", help="API metadata: fields, enums, extlinks")
    add_common(p, with_query=False)
    p.add_argument("--section", choices=["fields", "enums", "extlinks"], help="limit to one section")
    p.add_argument("--name", help="endpoint (vn, release, ...) or enum name (language, platform, ...)")
    p.add_argument("--key", action="append", help="drill into a JSON key (repeatable)")
    p.set_defaults(func=cmd_schema)

    p = sub.add_parser("set", help="add/update a VN in your list (PATCH /ulist/<id>)")
    add_common(p, with_query=False)
    p.add_argument("target", help="vndbid, e.g. v17")
    p.add_argument("--vote", type=int, help="vote 10-100")
    p.add_argument("--notes", help="personal notes")
    p.add_argument("--started", help="start date YYYY-MM-DD")
    p.add_argument("--finished", help="finish date YYYY-MM-DD")
    p.add_argument("--labels", help="replace all labels, e.g. '2,5'")
    p.add_argument("--labels-set", help="add labels without removing others")
    p.add_argument("--labels-unset", help="remove labels")
    p.add_argument("--null", action="append", help="clear a field, e.g. --null finished")
    p.add_argument("--yes", action="store_true", help="actually perform the write")
    p.set_defaults(func=cmd_set)

    p = sub.add_parser("unset", help="remove a VN from your list (DELETE /ulist/<id>)")
    add_common(p, with_query=False)
    p.add_argument("target", help="vndbid, e.g. v17")
    p.add_argument("--yes", action="store_true", help="actually perform the write")
    p.set_defaults(func=cmd_unset)

    p = sub.add_parser("rset", help="add/update a release in your list (PATCH /rlist/<id>)")
    add_common(p, with_query=False)
    p.add_argument("target", help="release vndbid, e.g. r123")
    p.add_argument("--status", type=int, help="0 Unknown, 1 Pending, 2 Obtained, 3 On loan, 4 Deleted")
    p.add_argument("--yes", action="store_true", help="actually perform the write")
    p.set_defaults(func=cmd_rset)

    p = sub.add_parser("runset", help="remove a release from your list (DELETE /rlist/<id>)")
    add_common(p, with_query=False)
    p.add_argument("target", help="release vndbid, e.g. r123")
    p.add_argument("--yes", action="store_true", help="actually perform the write")
    p.set_defaults(func=cmd_runset)

    return parser


def main(argv=None):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass

    parser = build_parser()
    args = parser.parse_args(argv)
    if not getattr(args, "func", None):
        parser.print_help()
        return 2
    try:
        result = args.func(args)
    except VndbError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    except json.JSONDecodeError as exc:
        print(f"error: invalid JSON - {exc}", file=sys.stderr)
        return 1
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    if result is not None:
        if getattr(args, "compact", False):
            print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
        else:
            print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
