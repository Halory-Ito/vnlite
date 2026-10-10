/**
 * 帖子正文渲染：把 `PostNode` 树转成 RN 节点。
 *
 * 顶层把 `quote` 拆成块（左边一条竖线），其余内容按行内节点渲染：
 * `<Text>` 可以嵌套，粗体 / 斜体 / 下划线 / 链接都靠嵌套 `<Text>` 表达，
 * `<br>` 换成换行符。剧透块默认盖住，点一下才显示（避免直接剧透）。
 *
 * React key 一律用解析器分配的 `node.id`（不用数组下标）。
 */

import * as Linking from "expo-linking";
import type { JSX } from "react";
import { useState } from "react";
import { Text, View } from "react-native";

import { useTranslation } from "@/hooks/use-translation";

import type { PostNode } from "../scrape";

/** 顶层节点切成「行内段 / 引用块」；key 取该段第一个节点的 id */
type Block = { key: number; type: "inline" | "quote"; nodes: PostNode[] };

function toBlocks(nodes: readonly PostNode[]): Block[] {
  const blocks: Block[] = [];
  let run: PostNode[] = [];
  const flush = (): void => {
    const first = run[0];
    if (!first) return;
    blocks.push({ key: first.id, type: "inline", nodes: run });
    run = [];
  };

  for (const node of nodes) {
    if (node.type === "quote") {
      flush();
      blocks.push({ key: node.id, type: "quote", nodes: node.children });
    } else {
      run.push(node);
    }
  }
  flush();
  return blocks;
}

export function PostContent({ nodes }: { nodes: PostNode[] }): JSX.Element {
  return (
    <View className="gap-2">
      {toBlocks(nodes).map((block) =>
        block.type === "quote" ? (
          <View key={block.key} className="border-l-2 border-border pl-2.5">
            <PostContent nodes={block.nodes} />
          </View>
        ) : (
          // 选区挂在最外层 Text 上（嵌套 Text 会被一起包含），所以正文可长按选中复制
          <Text key={block.key} selectable className="text-sm leading-[21px] text-foreground">
            <InlineNodes nodes={block.nodes} />
          </Text>
        )
      )}
    </View>
  );
}

function InlineNodes({ nodes }: { nodes: readonly PostNode[] }): JSX.Element {
  return (
    <>
      {nodes.map((node) => {
        switch (node.type) {
          case "text":
            return <Text key={node.id}>{node.text}</Text>;
          case "br":
            return <Text key={node.id}>{"\n"}</Text>;
          case "bold":
            return (
              <Text key={node.id} className="font-bold">
                <InlineNodes nodes={node.children} />
              </Text>
            );
          case "italic":
            return (
              <Text key={node.id} className="italic">
                <InlineNodes nodes={node.children} />
              </Text>
            );
          case "underline":
            return (
              <Text key={node.id} className="underline">
                <InlineNodes nodes={node.children} />
              </Text>
            );
          case "link":
            return (
              <Text
                key={node.id}
                className="text-link underline"
                suppressHighlighting
                onPress={() => void Linking.openURL(node.href)}
              >
                <InlineNodes nodes={node.children} />
              </Text>
            );
          case "spoiler":
            return <Spoiler key={node.id} nodes={node.children} />;
          case "quote":
            // 只会在引用里再套引用时走到这；行内退化成「」包裹
            return (
              <Text key={node.id} className="text-muted">
                {"「"}
                <InlineNodes nodes={node.children} />
                {"」"}
              </Text>
            );
          default:
            return null;
        }
      })}
    </>
  );
}

/** 剧透：默认遮住，点一下展开（再点收起） */
function Spoiler({ nodes }: { nodes: readonly PostNode[] }): JSX.Element {
  const { t } = useTranslation();
  const [shown, setShown] = useState(false);

  return (
    <Text
      className="rounded bg-default-soft text-muted"
      suppressHighlighting
      onPress={() => setShown((value) => !value)}
    >
      {shown ? <InlineNodes nodes={nodes} /> : t("review.spoilerHidden")}
    </Text>
  );
}
