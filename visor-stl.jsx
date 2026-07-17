import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';

// ─── Visualizador 3D de arquivos STL (Special Lab e Special Clinic) ───
// Um dedo gira a peça LIVREMENTE em todas as direções (Trackball, sem travas);
// dois dedos dão zoom (pinça) e movem; roda do mouse dá zoom no computador.
// Abre na hora com "carregando" — o dataURL pode chegar depois (null enquanto baixa).
export default function VisorSTL({ nome, dataURL, url, onFechar }) {
  const areaRef = useRef(null);
  const controlsRef = useRef(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [bytesSTL, setBytesSTL] = useState(null);

  // Formato novo: baixa o STL direto do armazém pelo link (binário puro)
  useEffect(() => {
    if (!url) return;
    let vivo = true;
    (async () => {
      try {
        const buf = await (await fetch(url)).arrayBuffer();
        if (vivo) setBytesSTL(buf);
      } catch (e) {
        if (vivo) { setCarregando(false); setErro('Não consegui baixar este arquivo STL.'); }
      }
    })();
    return () => { vivo = false; };
  }, [url]);

  useEffect(() => {
    const area = areaRef.current;
    if (!area || (!dataURL && !bytesSTL)) return;
    let vivo = true;
    let renderer, controls, frame, geometria, material;
    try {
      // dataURL (base64) → bytes do arquivo STL; ou bytes já baixados do armazém
      let buffer;
      if (bytesSTL) {
        buffer = bytesSTL;
      } else {
        const base64 = dataURL.split(',')[1];
        const bin = atob(base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        buffer = bytes.buffer;
      }

      geometria = new STLLoader().parse(buffer);
      geometria.computeVertexNormals();
      geometria.center();
      geometria.computeBoundingSphere();
      const raio = (geometria.boundingSphere && geometria.boundingSphere.radius) || 10;

      // Fundo transparente: a marca d'água SPECIAL (no HTML, atrás do canvas) aparece por trás da peça
      const cena = new THREE.Scene();
      cena.background = null;
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

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(area.clientWidth, area.clientHeight);
      area.appendChild(renderer.domElement);

      // Trackball: giro livre em todas as direções, sem trava nos polos.
      // Movimento domado: para rápido (sem deslizar longe) e a peça não foge do centro.
      controls = new TrackballControls(camera, renderer.domElement);
      controls.rotateSpeed = 2.6;
      controls.zoomSpeed = 1.3;
      controls.panSpeed = 0.5;
      controls.dynamicDampingFactor = 0.3;
      controls.minDistance = raio * 0.35;
      controls.maxDistance = raio * 8;
      controlsRef.current = controls;

      const limitePan = raio * 1.2;
      const desenhar = () => {
        if (!vivo) return;
        controls.update();
        // trela do movimento lateral: a peça nunca sai de perto do centro da tela
        if (controls.target.length() > limitePan) controls.target.clampLength(0, limitePan);
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
        controls.handleResize();
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
  }, [dataURL, bytesSTL]);

  return (
    <div data-sem-puxar style={{ position: 'fixed', inset: 0, zIndex: 9600, background: '#14130f', display: 'flex', flexDirection: 'column' }}>
      {/* Marca d'água SPECIAL no fundo, atrás da peça */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <svg width="min(64vw, 380px)" height="auto" viewBox="-50 -60 100 120" style={{ opacity: 0.055 }}>
          <path d="M0,-55 C4,-17 17,-4 46,0 C17,4 4,17 0,55 C-4,17 -17,4 -46,0 C-17,-4 -4,-17 0,-55 Z" fill="#B8935A" />
        </svg>
        <div style={{ color: 'rgba(184,147,90,0.14)', fontSize: 'min(5.5vw, 26px)', fontWeight: 300, letterSpacing: '0.5em', paddingLeft: '0.5em', marginTop: 6, fontFamily: "'Manrope', -apple-system, sans-serif" }}>SPECIAL</div>
      </div>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', paddingTop: 'calc(10px + env(safe-area-inset-top))', background: 'rgba(0,0,0,0.5)' }}>
        <span style={{ flex: 1, minWidth: 0, color: 'rgba(255,255,255,0.9)', fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Manrope', -apple-system, sans-serif" }}>🦷 {nome}</span>
        <button onClick={() => controlsRef.current && controlsRef.current.reset()} title="Recentralizar a peça"
          style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: 17, cursor: 'pointer', flexShrink: 0 }}>⌖</button>
        <button onClick={onFechar}
          style={{ width: 38, height: 38, borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.92)', color: '#1C1B19', fontSize: 18, fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>×</button>
      </div>
      <div ref={areaRef} style={{ flex: 1, touchAction: 'none', position: 'relative' }} />
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
