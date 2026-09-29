/**
 * CSS 副作用导入的类型声明。
 *
 * `src/app/_layout.tsx` 里有 `import "../global.css"`（Uniwind / Tailwind 必需），
 * 但 uniwind 自带的 `types.d.ts` 只声明了 `react-native` / `react-native-web` 的增强，
 * 没有声明 `*.css` 模块，TypeScript 会报 TS2882。这里补上。
 */

declare module "*.css";
declare module "*.css.ts";
