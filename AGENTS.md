称呼我为Master

这是一个[vndb](https://vndb.org)的移动客户端项目

可以在`.pi/skills`中查看vndb-api的skills

UI必须使用hero ui组件库，样式代码必须使用uniwind（tailwind css）

优先使用项目中已有的组件，不重复造轮子

对于根据日期筛选的功能，需要支持自定义开始日期和结束日期，不要只给出固定的时间段

包管理器使用 bun

按照 feature-first 的目录结构来

icon一律使用`@gravity-ui/icons`

tsx文件的代码尽量控制在200行以内

开发计划需要写入`plan.md`文件中，不论是已经实现还是准备实现的功能，并且需要按照Module（哪个模块）-Type（开发类型）-List（计划列表）的1级到2级目录的格式编写，其中List为复选框，已经实现的则需要做好标记`- [x] `

当我说要打包成apk的时候，你要使用EAS，而不是本地打包

编写组件的时候不要写多余的提示信息（Secondary），例如“长按可复制”、“摇一摇也能换”等

每一次推送代码到远程仓库时，都要记得更新软件版本（小版本），包括`constants/config.ts`和`app.json`
