/**
 * AR.js HTML template for WebView rendering.
 * Self-contained with external CDN libraries.
 */

export const AR_VIEWER_HTML = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
    <title>AR Viewer</title>
    <script src="https://cdn.jsdelivr.net/npm/three@r128/build/three.min.js"><\/script>
    <script src="https://cdn.jsdelivr.net/npm/ar.js@3.4.5/three.js/ar.js"><\/script>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #000;
      }
      canvas {
        width: 100%;
        height: 100%;
        display: block;
      }
      #status {
        position: fixed;
        top: 10px;
        left: 10px;
        color: #fff;
        font-size: 12px;
        background: rgba(0, 0, 0, 0.8);
        padding: 8px 12px;
        border-radius: 4px;
        font-family: monospace;
        z-index: 100;
      }
    </style>
  </head>
  <body>
    <div id="status">Carregando AR...</div>
    <script>
      let scene, camera, renderer, arToolkitSource, arToolkitContext;
      let anchors = new Map();
      let initialized = false;

      // Initialize AR.js
      async function init() {
        try {
          // Scene setup
          scene = new THREE.Scene();
          camera = new THREE.Camera();
          scene.add(camera);

          // Renderer
          renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
          renderer.setClearColor(new THREE.Color("lightblue"), 0);
          renderer.setSize(window.innerWidth, window.innerHeight);
          renderer.domElement.style.position = "absolute";
          renderer.domElement.style.top = "0px";
          document.body.appendChild(renderer.domElement);

          // AR.js setup
          arToolkitSource = new THREEx.ArToolkitSource({
            sourceType: "webcam",
          });

          arToolkitSource.init(() => {
            onSourceReady();
          });

          window.addEventListener("resize", () => {
            arToolkitSource.onResizeElement();
            arToolkitSource.copyElementSizeTo(renderer.domElement);
            if (arToolkitContext && arToolkitContext.arController !== null) {
              arToolkitSource.copyElementSizeTo(arToolkitContext.arController.canvas);
            }
          });
        } catch (e) {
          document.getElementById("status").textContent = "Erro: " + e.message;
        }
      }

      function onSourceReady() {
        arToolkitContext = new THREEx.ArToolkitContext({
          cameraParametersUrl: "https://cdn.jsdelivr.net/npm/ar.js@3.4.5/data/camera_para.dat",
          detectionMode: "color",
          canvasWidth: arToolkitSource.domElement.width,
          canvasHeight: arToolkitSource.domElement.height,
        });

        arToolkitContext.init(() => {
          camera.projectionMatrix.copy(arToolkitContext.getProjectionMatrix());
          document.getElementById("status").textContent = "AR Pronto ✓";
          initialized = true;
          animate();
        });
      }

      function animate() {
        requestAnimationFrame(animate);

        if (arToolkitSource && arToolkitSource.ready !== false) {
          arToolkitContext.update(arToolkitSource.domElement);
        }

        renderer.render(scene, camera);
      }

      // Bridge functions: React Native → WebView
      window.addARObject = function (id, type, x, y, scale, rotation, color) {
        if (!initialized) return;

        // Remove existing
        if (anchors.has(id)) {
          scene.remove(anchors.get(id));
        }

        let geometry, material, mesh;

        // Create geometry
        if (type === "circle") {
          geometry = new THREE.CylinderGeometry(scale * 0.1, scale * 0.1, 0.01, 32);
        } else if (type === "square") {
          geometry = new THREE.BoxGeometry(scale * 0.1, scale * 0.1, 0.01);
        } else if (type === "triangle") {
          geometry = new THREE.TetrahedronGeometry(scale * 0.1);
        } else {
          geometry = new THREE.SphereGeometry(scale * 0.1, 16, 16);
        }

        material = new THREE.MeshPhongMaterial({
          color: new THREE.Color(color),
          emissive: new THREE.Color(color),
          emissiveIntensity: 0.3,
          shininess: 100,
        });
        mesh = new THREE.Mesh(geometry, material);

        // Position
        mesh.position.x = (x - 0.5) * 0.3;
        mesh.position.y = (0.5 - y) * 0.3;
        mesh.position.z = -0.5;
        mesh.rotation.z = (rotation * Math.PI) / 180;

        scene.add(mesh);
        anchors.set(id, mesh);

        // Add lights if needed
        if (scene.children.filter((c) => c instanceof THREE.Light).length === 0) {
          const light = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
          scene.add(light);
          const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
          directionalLight.position.set(1, 1, 1);
          scene.add(directionalLight);
        }
      };

      window.removeARObject = function (id) {
        if (anchors.has(id)) {
          scene.remove(anchors.get(id));
          anchors.delete(id);
        }
      };

      window.updateARObject = function (id, x, y, scale, rotation, color) {
        const mesh = anchors.get(id);
        if (!mesh) return;
        mesh.position.x = (x - 0.5) * 0.3;
        mesh.position.y = (0.5 - y) * 0.3;
        mesh.rotation.z = (rotation * Math.PI) / 180;
        if (mesh.material instanceof THREE.MeshPhongMaterial) {
          mesh.material.color.setStyle(color);
          mesh.material.emissive.setStyle(color);
        }
      };

      window.clearARObjects = function () {
        anchors.forEach((mesh) => scene.remove(mesh));
        anchors.clear();
      };

      // Start
      init();
    </script>
  </body>
</html>
`;

// Encode as base64 data URI for WebView loading
export function getARViewerUri(): string {
  try {
    // btoa works in React Native
    const encoded = btoa(AR_VIEWER_HTML);
    return `data:text/html;base64,${encoded}`;
  } catch (_e) {
    // Fallback: return HTML directly (some WebView versions may support this)
    return `data:text/html,${encodeURIComponent(AR_VIEWER_HTML)}`;
  }
}
