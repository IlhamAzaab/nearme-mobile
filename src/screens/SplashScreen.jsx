import React, { useCallback, useMemo } from "react";
import { SafeAreaView, StatusBar, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

const SPLASH_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#06C168}
.wrap{width:100%;height:100%;overflow:hidden;background:#06C168;position:relative}
.scene{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;position:absolute;inset:0}
.logo-svg{width:min(88vw,360px);height:auto;display:block}
.letter{opacity:0;transform:translateY(140px) scale(.5);transform-origin:50% 100%}
.dot{width:7px;height:7px;border-radius:50%;background:#000;opacity:0;display:inline-block;transform:scale(0)}
.dots-row{display:flex;align-items:center;justify-content:center;margin-top:18px;gap:4px}
.black-cover{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;z-index:10}
</style>
</head>
<body>
<div class="wrap" id="wrap">
  <div class="scene" id="scene">
    <svg class="logo-svg" viewBox="180 430 740 230" aria-label="MEEZO logo">
      <path id="lM" class="letter" fill="#000" d="m441.9,475.4l-23.01,44.91c-1.96,3.83-5.1,6.86-9.03,8.71-30.64,14.45-56.96,26.84-66.45,31.3-2.31,1.09-5.25.69-7.61-1.03l-14.61-10.6-16.76-12.16-1.95-1.41c-4.49-3.26-10.24-2.47-12.57,1.71l-30.61,56.84c-7.03,13.06-20.71,20.85-36.62,20.85h-40.32c-3.86,0-6.8-4.34-5.11-7.51l41.38-76.8,21.66-40.22,3-5.57c11.39-21.13,40.35-25.25,62.84-8.93l12.1,8.78c9.65,7,19.3,14,28.95,21,3.09,2.25,6.19,4.5,9.28,6.74l82.97-39.09c1.44-.68,3.19,1.08,2.47,2.48Z"/>
      <path id="lE1" class="letter" fill="#000" d="m550.76,465.48h-89.17c-2.14,0-4.76,1.74-5.85,3.88l-71.86,141.03c-1.09,2.14-.24,3.88,1.9,3.88h91.3c2.14,0,4.75-1.74,5.84-3.88l18.04-35.4c1.09-2.14.24-3.87-1.9-3.87h-36.89c-2.14,0-2.99-1.73-1.9-3.87l3.1-6.07c1.09-2.14,3.7-3.87,5.84-3.87h31.36c2.14,0,4.76-1.74,5.85-3.88l14.57-28.6c1.09-2.14.24-3.87-1.9-3.87h-31.36c-2.14,0-2.99-1.73-1.9-3.87l2.34-4.58c1.09-2.14,3.7-3.88,5.84-3.88h34.77c2.13,0,4.75-1.73,5.84-3.87l18.04-35.4c1.09-2.14.24-3.88-1.9-3.88Z"/>
      <path id="lE2" class="letter" fill="#000" d="m660.22,465.48h-89.17c-2.14,0-4.76,1.74-5.85,3.88l-71.86,141.03c-1.09,2.14-.24,3.88,1.9,3.88h91.3c2.14,0,4.75-1.74,5.84-3.88l18.04-35.4c1.09-2.14.24-3.87-1.9-3.87h-36.89c-2.13,0-2.99-1.73-1.9-3.87l3.1-6.07c1.09-2.14,3.7-3.87,5.84-3.87h31.37c2.13,0,4.75-1.74,5.84-3.88l14.57-28.6c1.09-2.14.24-3.87-1.9-3.87h-31.36c-2.14,0-2.99-1.73-1.9-3.87l2.34-4.58c1.09-2.14,3.71-3.88,5.84-3.88h34.77c2.14,0,4.75-1.73,5.84-3.87l18.04-35.4c1.09-2.14.24-3.88-1.9-3.88Z"/>
      <path id="lZ" class="letter" fill="#000" d="m782.76,470.43c2.16-2.3,1.79-4.86-.71-4.86h-101.74c-2.52,0-5.62,2.05-6.9,4.57l-17.16,33.68c-1.29,2.53-.29,4.58,2.24,4.58h27.48c2.5,0,2.88,2.56.72,4.85l-89.65,95.15c-2.16,2.29-1.78,4.85.72,4.85h112.31c2.52,0,5.62-2.04,6.9-4.57l10.68-33.68c1.29-2.53.28-4.57-2.25-4.57h-31.76c-2.5,0-2.87-2.57-.71-4.86l89.83-95.14Z"/>
      <path id="lO" class="letter" fill="#000" d="m869.58,586.15h-68.56s.09-.07.13-.12c-1.92-.44-3.34-2.16-3.34-4.2,0-1.19.48-2.28,1.26-3.06.79-.79,1.87-1.27,3.06-1.27h60.25c1.19,0,2.27-.48,3.05-1.26.79-.78,1.27-1.86,1.27-3.06,0-2.38-1.94-4.32-4.32-4.32h-42.37s.09-.08.14-.12c-1.91-.45-3.32-2.16-3.32-4.2,0-1.19.48-2.27,1.26-3.05.79-.79,1.87-1.27,3.06-1.27h32.57c1.2,0,2.28-.48,3.06-1.26.78-.78,1.26-1.86,1.26-3.06,0-2.38-1.93-4.32-4.32-4.32h-14.84c4.43-4.21,8.72-8.5,12.77-12.92,20.38-22.25,24.31-49.41,10.74-63.1-14.41-14.57-43.15-12.8-69.81,4.29-26.28,16.84-43.27,43.87-40.63,65.46,1.87,15.19,4.5,30.02,6.94,44.95.82,5.09,1.72,10.15,2.67,15.37.6,3.31,3.07,5.55,5.92,6.22.6.15,1.21.22,1.83.22h65.52c1.19,0,2.27-.49,3.06-1.27.78-.78,1.26-1.86,1.26-3.05,0-2.39-1.93-4.32-4.32-4.32h-52.95l.02-.02c-2.2-.2-3.92-2.06-3.92-4.3,0-1.19.48-2.27,1.26-3.06.78-.78,1.86-1.26,3.06-1.26h87.28c1.2,0,2.28-.49,3.06-1.27.78-.78,1.26-1.86,1.26-3.05,0-2.39-1.93-4.32-4.32-4.32Zm-78.14-67.05c5-10.73,17.74-19.42,28.47-19.42s15.36,8.69,10.35,19.42c-4.99,10.71-17.74,19.41-28.46,19.41s-15.36-8.7-10.36-19.41Z"/>
    </svg>
    <div class="dots-row">
      <span class="dot" id="d0"></span>
      <span class="dot" id="d1"></span>
      <span class="dot" id="d2"></span>
    </div>
  </div>
  <div class="black-cover" id="blackCover"></div>
</div>

<script>
const easeOutBack = t => { const c=1.70158,c3=c+1; return 1+c3*Math.pow(t-1,3)+c*Math.pow(t-1,2); };
const easeOut = t => 1 - Math.pow(1 - t, 4);
const easeIn = t => t * t * t;
let splashStarted = false;

function tween(duration, delay, update, easeF) {
  return new Promise(res => {
    setTimeout(() => {
      const s = performance.now();
      const fn = now => {
        const p = Math.min((now-s)/duration,1);
        update((easeF||easeOut)(p));
        if(p<1) requestAnimationFrame(fn); else res();
      };
      requestAnimationFrame(fn);
    }, delay||0);
  });
}

function reset() {
  ["lM","lE1","lE2","lZ","lO"].forEach(id => {
    const el = document.getElementById(id);
    el.style.opacity = 0;
    el.style.transform = "translateY(140px) scale(0.5)";
  });

  ["d0","d1","d2"].forEach(id => {
    const el = document.getElementById(id);
    el.style.opacity = 0;
    el.style.transform = "scale(0)";
  });

  const scene = document.getElementById("scene");
  scene.style.opacity = 1;
  scene.style.transform = "scale(1)";
  document.getElementById("blackCover").style.opacity = 0;
}

function doPulse() {
  return new Promise(res => {
    const ids=["lM","lE1","lE2","lZ","lO"]; let done=0;
    ids.forEach((id,i) => {
      setTimeout(() => {
        const el = document.getElementById(id);
        const s = performance.now();
        const fn = now => {
          const p = Math.min((now-s)/300,1);
          const sc = p<0.5 ? 1+0.09*(p*2) : 1+0.09*(1-(p-0.5)*2);
          el.style.transform = "translateY(0px) scale(" + sc + ")";
          if (p<1) requestAnimationFrame(fn);
          else { el.style.transform = "translateY(0px) scale(1)"; done += 1; if (done===ids.length) res(); }
        };
        requestAnimationFrame(fn);
      }, i*45);
    });
  });
}

function doWave() {
  return new Promise(res => {
    const ids=["lM","lE1","lE2","lZ","lO"]; let done=0;
    ids.forEach((id,i) => {
      setTimeout(() => {
        const el=document.getElementById(id);
        const s=performance.now();
        const fn=now => {
          const p=Math.min((now-s)/300,1);
          const ty=p<0.5?-15*(p*2):-15*(1-(p-0.5)*2);
          el.style.transform = "translateY(" + ty + "px) scale(1)";
          if(p<1) requestAnimationFrame(fn);
          else { el.style.transform='translateY(0px) scale(1)'; done += 1; if(done===ids.length) res(); }
        };
        requestAnimationFrame(fn);
      }, i*55);
    });
  });
}

function signalDone() {
  if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
    window.ReactNativeWebView.postMessage("SPLASH_DONE");
  }
}

function doZoomExit() {
  ["d0","d1","d2"].forEach((id,i) => {
    tween(180, i*60, e => {
      const el=document.getElementById(id);
      el.style.opacity = e;
      el.style.transform = "scale(" + e + ")";
    });
  });

  setTimeout(() => {
    const scene=document.getElementById("scene");
    const black=document.getElementById("blackCover");

    tween(320, 0, e => {
      scene.style.transform = "scale(" + (1 + e * 18) + ")";
      scene.style.opacity = Math.max(1-e*3,0);
    }, easeIn);

    tween(220, 200, e => {
      black.style.opacity = e;
    }, easeIn).then(() => {
      tween(280, 0, e => {
        black.style.opacity = 1-e;
      }, easeOut).then(() => {
        document.getElementById("wrap").style.opacity = 0;
        signalDone();
      });
    });
  }, 500);
}

function startAnim() {
  if (splashStarted) return;
  splashStarted = true;

  reset();
  const ids=["lM","lE1","lE2","lZ","lO"];

  ids.forEach((id,i) => {
    tween(440,100+i*80,e => {
      const el = document.getElementById(id);
      el.style.opacity = Math.min(e*1.7,1);
      el.style.transform =
        "translateY(" + (140 - 140 * e) + "px) scale(" + (0.5 + 0.5 * e) + ")";
    },easeOutBack);
  });

  const landed = 100 + 4*80 + 440;

  setTimeout(() => {
    doPulse().then(() => {
      setTimeout(() => {
        doWave().then(() => setTimeout(doZoomExit,180));
      },200);
    });
  }, landed + 180);
}

setTimeout(startAnim, 300);
</script>
</body>
</html>`;

export default function SplashScreen({ onComplete }) {
  const webViewSource = useMemo(() => ({ html: SPLASH_HTML }), []);

  const handleMessage = useCallback(
    (event) => {
      if (event?.nativeEvent?.data === "SPLASH_DONE") {
        onComplete?.();
      }
    },
    [onComplete],
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#06C168" barStyle="light-content" />
      <WebView
        originWhitelist={["*"]}
        source={webViewSource}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        style={styles.webview}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#06C168",
  },
  webview: {
    flex: 1,
    backgroundColor: "#06C168",
  },
});
