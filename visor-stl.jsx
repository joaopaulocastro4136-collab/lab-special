import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ─── Visualizador 3D de arquivos STL (Special Lab e Special Clinic) ───
// Um dedo gira a peça; dois dedos dão zoom (pinça) e movem; roda do mouse dá zoom no computador.
// Só visualização: abrir, olhar, fechar.
export default function VisorSTL({ nome, dataURL, onFechar }) {
  const areaRef = useRef(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const area = areaRef.current;
    if (!area || !dataURL) return;
    let vivo = true;
    let renderer, controls, frame, geometria, material;
    try {
      // dataURL (base64) → bytes do arquivo STL
      const base64 = dataURL.split(',')[1];
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

      geometria = new STLLoader().parse(bytes.buffer);
      geometria.computeVertexNormals();
      geometria.center();
      geometria.computeBoundingSphere();
      const raio = (geometria.boundingSphere && geometria.boundingSphere.radius) || 10;

      const cena = new THREE.Scene();
      cena.background = new THREE.Color(0x14130f);
      material = new THREE.MeshStandardMaterial({ color: 0xEDE7DC, metalness: 0.05, roughness: 0.5 });
      cena.add(new THREE.Mesh(geometria, material));

      const camera = new THREE.PerspectiveCamera(45, area.clientWidth / Math.max(1, area.clientHeight), Math.max(0.01, raio / 100), raio * 30);
      camera.position.set(raio * 1.5, raio * 1.0, raio * 1.9);

      const luzAmbiente = new THREE.HemisphereLight(0xffffff, 0x55503f, 1.15);
      const luzPrincipal = new THREE.DirectionalLight(0xfff2dd, 1.5);
      luzPrincipal.position.set(1, 2, 1.5);
      const luzPreencher = new THREE.DirectionalLight(0xc8d4ff, 0.45);
      luzPreencher.position.set(-1.5, -1, -1);
      cena.add(luzAmbiente, luzPrincipal, luzPreencher);

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(area.clientWidth, area.clientHeight);
      area.appendChild(renderer.domElement);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = raio * 0.4;
      controls.maxDistance = raio * 8;

      const desenhar = () => {
        if (!vivo) return;
        controls.update();
        renderer.render(cena, camera);
        frame = requestAnimationFrame(desenhar);
      };
      desenhar();
      setCarregando(false);

      const aoRedimensionar = () => {
        if (!vivo || !area.clientWidth) return;
        camera.aspect = area.clientWidth / Math.max(1, area.clientHeight);
        camera.updateProjectionMatrix();
        renderer.setSize(area.clientWidth, area.clientHeight);
      };
      window.addEventListener('resize', aoRedimensionar);

      return () => {
        vivo = false;
        if (frame) cancelAnimationFrame(frame);
        window.removeEventListener('resize', aoRedimensionar);
        controls.dispose();
        renderer.dispose();
        geometria.dispose();
        material.dispose();
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      };
    } catch (e) {
      console.error('Erro ao abrir STL', e);
      setCarregando(false);
      setErro('Não consegui abrir este arquivo STL.');
    }
  }, [dataURL]);

  return (
    <div data-sem-puxar style={{ position: 'fixed', inset: 0, zIndex: 9600, background: '#14130f', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', paddingTop: 'calc(10px + env(safe-area-inset-top))', background: 'rgba(0,0,0,0.5)' }}>
        <span style={{ flex: 1, minWidth: 0, color: 'rgba(255,255,255,0.9)', fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Manrope', -apple-system, sans-serif" }}>🦷 {nome}</span>
        <button onClick={onFechar}
          style={{ width: 38, height: 38, borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.92)', color: '#1C1B19', fontSize: 18, fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>×</button>
      </div>
      <div ref={areaRef} style={{ flex: 1, touchAction: 'none' }} />
      {carregando && !erro && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: "'Manrope', -apple-system, sans-serif", pointerEvents: 'none' }}>Abrindo o modelo 3D...</div>
      )}
      {erro && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontFamily: "'Manrope', -apple-system, sans-serif" }}>{erro}</div>
      )}
      <div style={{ position: 'absolute', bottom: 'calc(12px + env(safe-area-inset-bottom))', left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.55)', fontSize: 11.5, pointerEvents: 'none', fontFamily: "'Manrope', -apple-system, sans-serif" }}>
        Um dedo gira • dois dedos dão zoom e movem
      </div>
    </div>
  );
}
