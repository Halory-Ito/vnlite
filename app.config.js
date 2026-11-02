const { expo } = require("./app.json");
module.exports = {
  ...expo,
  extra: {
    ...expo.extra,
    baidu: {
      appKey: process.env.BAIDU_APP_KEY || "",
      secretKey: process.env.BAIDU_SECRET_KEY || "",
      redirectUri: process.env.BAIDU_REDIRECT_URI || "oob",
    },
  },
};
