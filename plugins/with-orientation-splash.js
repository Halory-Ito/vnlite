/**
 * Expo config plugin：竖屏 / 横屏各用一张全屏启动图。
 *
 * `expo-splash-screen` 只接受一张居中图标。Android 12+ 的系统启动画面
 * 也只能是「底色 + 圆形图标」，放不进全屏插画。
 *
 * 所以这里在 prebuild 之后补两层：
 * - iOS：改写 `SplashScreen.storyboard`，按高度 size class 切换两张图
 *   （手机横屏是 compact height；iPad 横竖屏都是 regular，系统启动图
 *   无法再拆，iPad 横屏会用竖屏图 aspect-fill）
 * - Android：把两张图打进 `drawable-nodpi`，MainActivity 起来后立刻盖一层
 *   `centerCrop` 的 ImageView，并让系统那层圆形图标退场
 *
 * 必须排在 `expo-splash-screen` 插件后面，否则 storyboard 会被它盖回去。
 */

const fs = require("fs");
const path = require("path");

const { withFinalizedMod, withMainActivity } = require("expo/config-plugins");

const PORTRAIT_FILE = "splash-screen-vertical.png";
const LANDSCAPE_FILE = "splash-screen-horizon.png";
const BACKGROUND = "#fcbfee";

const IOS_PORTRAIT = "SplashScreenPortrait";
const IOS_LANDSCAPE = "SplashScreenLandscape";

function withOrientationSplash(config) {
  config = withMainActivity(config, (cfg) => {
    const src = cfg.modResults.contents;
    if (src.includes("OrientationSplash.install")) return cfg;
    if (!src.includes("super.onCreate(null)")) {
      throw new Error("with-orientation-splash: MainActivity 里没有 super.onCreate(null)");
    }
    cfg.modResults.contents = src.replace(
      "super.onCreate(null)",
      "super.onCreate(null)\n    OrientationSplash.install(this)"
    );
    return cfg;
  });

  config = withFinalizedMod(config, [
    "android",
    async (cfg) => {
      if (cfg.modRequest.introspect) return cfg;
      await writeAndroidAssets(cfg);
      return cfg;
    },
  ]);

  config = withFinalizedMod(config, [
    "ios",
    async (cfg) => {
      if (cfg.modRequest.introspect) return cfg;
      await writeIosAssets(cfg);
      return cfg;
    },
  ]);

  return config;
}

async function writeAndroidAssets(config) {
  const projectRoot = config.modRequest.projectRoot;
  const packageName = config.android?.package;
  if (!packageName) {
    throw new Error("with-orientation-splash: 缺少 android.package");
  }

  const resDir = path.join(projectRoot, "android/app/src/main/res/drawable-nodpi");
  const javaDir = path.join(projectRoot, "android/app/src/main/java", ...packageName.split("."));

  await fs.promises.mkdir(resDir, { recursive: true });
  await fs.promises.mkdir(javaDir, { recursive: true });

  await fs.promises.copyFile(
    path.join(projectRoot, "assets/images", PORTRAIT_FILE),
    path.join(resDir, "splashscreen_port.png")
  );
  await fs.promises.copyFile(
    path.join(projectRoot, "assets/images", LANDSCAPE_FILE),
    path.join(resDir, "splashscreen_land.png")
  );
  await fs.promises.writeFile(
    path.join(javaDir, "OrientationSplash.kt"),
    kotlinSource(packageName),
    "utf8"
  );
}

function kotlinSource(packageName) {
  return `package ${packageName}

import android.app.Activity
import android.content.res.Configuration
import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import com.facebook.react.bridge.ReactMarker
import com.facebook.react.bridge.ReactMarkerConstants
import expo.modules.splashscreen.SplashScreenManager

/**
 * 盖在窗口上的全屏启动图。
 *
 * 系统启动画面（Android 12+）只能显示圆形图标，这里在 Activity 起来后
 * 立刻让它退场，改由这张图撑过 JS 加载。横竖屏各一张，按当前方向选取。
 */
object OrientationSplash {
  private const val TAG = "orientation-splash"
  private const val FALLBACK_MS = 12000L

  @JvmStatic
  fun install(activity: Activity) {
    val decor = activity.window.decorView as ViewGroup
    if (decor.findViewWithTag<View>(TAG) != null) return

    val splash = ImageView(activity).apply {
      tag = TAG
      setBackgroundColor(Color.parseColor("${BACKGROUND}"))
      scaleType = ImageView.ScaleType.CENTER_CROP
      setImageResource(imageFor(activity))
      isClickable = true
      importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
      layoutParams = FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT
      )
    }
    decor.addView(splash)

    val mainHandler = Handler(Looper.getMainLooper())
    lateinit var listener: ReactMarker.MarkerListener
    val dismiss = Runnable {
      ReactMarker.removeListener(listener)
      (splash.parent as? ViewGroup)?.removeView(splash)
    }
    listener = ReactMarker.MarkerListener { name, _, _ ->
      if (name == ReactMarkerConstants.CONTENT_APPEARED) {
        mainHandler.post(dismiss)
      }
    }
    ReactMarker.addListener(listener)
    mainHandler.postDelayed(dismiss, FALLBACK_MS)

    // 系统那层圆形图标立刻让路，退出动画底下已经是全屏图
    SplashScreenManager.hide()
  }

  private fun imageFor(activity: Activity): Int {
    val landscape =
      activity.resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
    return if (landscape) R.drawable.splashscreen_land else R.drawable.splashscreen_port
  }
}
`;
}

async function writeIosAssets(config) {
  const projectName = config.modRequest.projectName;
  if (!projectName) {
    throw new Error("with-orientation-splash: 缺少 iOS projectName");
  }
  const iosRoot = path.join(config.modRequest.platformProjectRoot, projectName);
  const projectRoot = config.modRequest.projectRoot;

  await writeImageset(
    iosRoot,
    IOS_PORTRAIT,
    path.join(projectRoot, "assets/images", PORTRAIT_FILE)
  );
  await writeImageset(
    iosRoot,
    IOS_LANDSCAPE,
    path.join(projectRoot, "assets/images", LANDSCAPE_FILE)
  );
  await fs.promises.writeFile(
    path.join(iosRoot, "SplashScreen.storyboard"),
    storyboardXml(),
    "utf8"
  );
}

async function writeImageset(iosRoot, name, source) {
  const dir = path.join(iosRoot, "Images.xcassets", `${name}.imageset`);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.copyFile(source, path.join(dir, "image.png"));
  await fs.promises.writeFile(
    path.join(dir, "Contents.json"),
    JSON.stringify(
      {
        images: [{ idiom: "universal", filename: "image.png" }],
        info: { author: "xcode", version: 1 },
      },
      null,
      2
    ),
    "utf8"
  );
}

function storyboardXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="32700.99.1234" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" launchScreen="YES" useTraitCollections="YES" useSafeAreas="YES" colorMatched="YES" initialViewController="EXPO-VIEWCONTROLLER-1">
    <device id="retina6_12" orientation="portrait" appearance="light"/>
    <dependencies>
        <deployment identifier="iOS"/>
        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="22685"/>
        <capability name="Safe area layout guides" minToolsVersion="9.0"/>
        <capability name="documents saved in the Xcode 8 format" minToolsVersion="8.0"/>
    </dependencies>
    <scenes>
        <scene sceneID="EXPO-SCENE-1">
            <objects>
                <viewController storyboardIdentifier="SplashScreenViewController" id="EXPO-VIEWCONTROLLER-1" sceneMemberID="viewController">
                    <view key="view" userInteractionEnabled="NO" contentMode="scaleToFill" insetsLayoutMarginsFromSafeArea="NO" id="EXPO-ContainerView" userLabel="ContainerView">
                        <rect key="frame" x="0.0" y="0.0" width="393" height="852"/>
                        <autoresizingMask key="autoresizingMask" flexibleMaxX="YES" flexibleMaxY="YES"/>
                        <subviews>
                            <imageView clipsSubviews="YES" userInteractionEnabled="NO" contentMode="scaleAspectFill" horizontalHuggingPriority="251" verticalHuggingPriority="251" image="${IOS_PORTRAIT}" translatesAutoresizingMaskIntoConstraints="NO" id="SPLASH-PORTRAIT" userLabel="SplashPortrait">
                                <rect key="frame" x="0.0" y="0.0" width="393" height="852"/>
                                <variation key="heightClass=compact" hidden="YES"/>
                            </imageView>
                            <imageView hidden="YES" clipsSubviews="YES" userInteractionEnabled="NO" contentMode="scaleAspectFill" horizontalHuggingPriority="251" verticalHuggingPriority="251" image="${IOS_LANDSCAPE}" translatesAutoresizingMaskIntoConstraints="NO" id="SPLASH-LANDSCAPE" userLabel="SplashLandscape">
                                <rect key="frame" x="0.0" y="0.0" width="852" height="393"/>
                                <variation key="heightClass=compact" hidden="NO"/>
                            </imageView>
                        </subviews>
                        <viewLayoutGuide key="safeArea" id="Rmq-lb-GrQ"/>
                        <color key="backgroundColor" name="SplashScreenBackground"/>
                        <constraints>
                            <constraint firstItem="SPLASH-PORTRAIT" firstAttribute="top" secondItem="EXPO-ContainerView" secondAttribute="top" id="pt-top"/>
                            <constraint firstItem="SPLASH-PORTRAIT" firstAttribute="leading" secondItem="EXPO-ContainerView" secondAttribute="leading" id="pt-lead"/>
                            <constraint firstItem="SPLASH-PORTRAIT" firstAttribute="trailing" secondItem="EXPO-ContainerView" secondAttribute="trailing" id="pt-trail"/>
                            <constraint firstItem="SPLASH-PORTRAIT" firstAttribute="bottom" secondItem="EXPO-ContainerView" secondAttribute="bottom" id="pt-bot"/>
                            <constraint firstItem="SPLASH-LANDSCAPE" firstAttribute="top" secondItem="EXPO-ContainerView" secondAttribute="top" id="ls-top"/>
                            <constraint firstItem="SPLASH-LANDSCAPE" firstAttribute="leading" secondItem="EXPO-ContainerView" secondAttribute="leading" id="ls-lead"/>
                            <constraint firstItem="SPLASH-LANDSCAPE" firstAttribute="trailing" secondItem="EXPO-ContainerView" secondAttribute="trailing" id="ls-trail"/>
                            <constraint firstItem="SPLASH-LANDSCAPE" firstAttribute="bottom" secondItem="EXPO-ContainerView" secondAttribute="bottom" id="ls-bot"/>
                        </constraints>
                    </view>
                </viewController>
                <placeholder placeholderIdentifier="IBFirstResponder" id="EXPO-PLACEHOLDER-1" userLabel="First Responder" sceneMemberID="firstResponder"/>
            </objects>
            <point key="canvasLocation" x="140.625" y="129.4921875"/>
        </scene>
    </scenes>
    <resources>
        <image name="${IOS_PORTRAIT}" width="941" height="1672"/>
        <image name="${IOS_LANDSCAPE}" width="1672" height="941"/>
        <namedColor name="SplashScreenBackground">
            <color alpha="1.000" blue="0.933333333333333" green="0.749019607843137" red="0.988235294117647" customColorSpace="sRGB" colorSpace="custom"/>
        </namedColor>
    </resources>
</document>
`;
}

module.exports = withOrientationSplash;
