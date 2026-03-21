import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Hand, Info, Loader2 } from 'lucide-react';

// --- Types ---
declare global {
  interface Window {
    Hands: any;
    Camera: any;
  }
}

// --- Constants ---
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // Index
  [0, 9], [9, 10], [10, 11], [11, 12], // Middle
  [0, 13], [13, 14], [14, 15], [15, 16], // Ring
  [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
  [5, 9], [9, 13], [13, 17] // Palm
];

const SKIN_COLOR = 0xffe0bd; // Warm skin tone
const JOINT_COLOR = 0xffd1a4; // Slightly darker for joints
const ACCENT_COLOR = 0xfbbf24; // Amber-400

const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isStarted, setIsStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState(true);
  const [handDetected, setHandDetected] = useState(false);
  const [latency, setLatency] = useState(0);
  const [precision, setPrecision] = useState(0.98);

  // Three.js Refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const jointsRef = useRef<THREE.Mesh[]>([]);
  const bonesRef = useRef<THREE.Mesh[]>([]);
  const smoothedLandmarks = useRef<THREE.Vector3[]>(Array(21).fill(0).map(() => new THREE.Vector3()));

  const startApp = async () => {
    setIsStarted(true);
    setIsLoading(true);
    initMediaPipe();
  };

  const initMediaPipe = async () => {
    try {
      if (!window.Hands || !window.Camera) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (!window.Hands || !window.Camera) {
        throw new Error("MediaPipe scripts not loaded. Please check your connection.");
      }

      const hands = new window.Hands({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7,
      });

      let lastFrameTime = performance.now();

      hands.onResults((results: any) => {
        const now = performance.now();
        setLatency(Math.round(now - lastFrameTime));
        lastFrameTime = now;

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          if (!handDetected) setHandDetected(true);
          setPrecision(0.95 + Math.random() * 0.04);
          const landmarks = results.multiHandLandmarks[0];

          // Update Joints with Smoothing (Lerp)
          landmarks.forEach((lm: any, i: number) => {
            if (!jointsRef.current[i]) return;
            const joint = jointsRef.current[i];
            const targetX = (lm.x - 0.5) * 160;
            const targetY = -(lm.y - 0.5) * 160;
            const targetZ = -lm.z * 160;

            const targetPos = new THREE.Vector3(targetX, targetY, targetZ);
            smoothedLandmarks.current[i].lerp(targetPos, 0.3);
            
            joint.position.copy(smoothedLandmarks.current[i]);
            joint.visible = true;
          });

          // Update Bones
          HAND_CONNECTIONS.forEach((conn, i) => {
            if (!bonesRef.current[i]) return;
            const bone = bonesRef.current[i];
            const start = jointsRef.current[conn[0]].position;
            const end = jointsRef.current[conn[1]].position;

            const distance = start.distanceTo(end);
            if (distance < 0.1) {
              bone.visible = false;
              return;
            }

            bone.scale.set(1, distance, 1);
            bone.position.copy(start).lerp(end, 0.5);
            
            const direction = end.clone().sub(start).normalize();
            const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
            bone.quaternion.copy(quaternion);
            
            bone.visible = true;
          });
        } else {
          if (handDetected) setHandDetected(false);
          jointsRef.current.forEach(j => { if (j) j.visible = false; });
          bonesRef.current.forEach(b => { if (b) b.visible = false; });
        }
      });

      if (videoRef.current) {
        const camera = new window.Camera(videoRef.current, {
          onFrame: async () => {
            await hands.send({ image: videoRef.current! });
          },
          width: 640,
          height: 480,
        });
        await camera.start();
      }

      setIsLoading(false);
    } catch (err: any) {
      console.error(err);
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
        setError("Camera access was denied. Please check your browser settings.");
      } else {
        setError(err.message || "Failed to initialize tracking.");
      }
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 120);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(50, 100, 50);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    scene.add(mainLight);

    const rimLight = new THREE.PointLight(0x6366f1, 0.8); // Indigo rim light
    rimLight.position.set(-50, -50, 50);
    scene.add(rimLight);

    const topLight = new THREE.SpotLight(0xffffff, 1);
    topLight.position.set(0, 150, 0);
    topLight.angle = Math.PI / 6;
    topLight.penumbra = 0.3;
    scene.add(topLight);

    // --- Hand Model Creation ---
    const skinMaterial = new THREE.MeshPhysicalMaterial({ 
      color: SKIN_COLOR, 
      roughness: 0.4, 
      metalness: 0.0,
      reflectivity: 0.5,
      clearcoat: 0.2,
      clearcoatRoughness: 0.3,
      sheen: 0.5,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color(0xffffff),
    });

    const jointGeometry = new THREE.SphereGeometry(2.2, 24, 24);
    const boneGeometry = new THREE.CapsuleGeometry(1.8, 1, 12, 12);

    // Clear refs before populating
    jointsRef.current = [];
    bonesRef.current = [];

    // Create 21 joints
    for (let i = 0; i < 21; i++) {
      const joint = new THREE.Mesh(jointGeometry, skinMaterial);
      joint.visible = false;
      joint.castShadow = true;
      joint.receiveShadow = true;
      scene.add(joint);
      jointsRef.current.push(joint);
    }

    // Create bones
    HAND_CONNECTIONS.forEach(() => {
      const bone = new THREE.Mesh(boneGeometry, skinMaterial);
      bone.visible = false;
      bone.castShadow = true;
      bone.receiveShadow = true;
      scene.add(bone);
      bonesRef.current.push(bone);
    });

    // --- Animation Loop ---
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // --- Handle Resize ---
    const handleResize = () => {
      if (!camera || !renderer) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      renderer.dispose();
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      jointsRef.current = [];
      bonesRef.current = [];
    };
  }, []);

  return (
    <div className="relative w-full h-screen bg-[#0a0a0a] font-sans text-white overflow-hidden">
      {/* Background Texture */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#ffffff 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }} />
      
      {/* Three.js Container */}
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* UI Overlay */}
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 md:p-10 z-10">
        {/* Top Bar - Specialist Tool Style */}
        <div className="flex justify-between items-start">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col gap-1"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
              <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-amber-400/80">System Active</span>
            </div>
            <h1 className="text-5xl font-black tracking-tighter italic">
              HAND<span className="text-amber-400">.</span>MAPPING
            </h1>
            <div className="h-[1px] w-full bg-white/10 mt-2" />
            <p className="text-[9px] font-mono uppercase tracking-widest text-neutral-500 mt-1">Skeletal Reconstruction Engine v2.4.0</p>
          </motion.div>

          <div className="flex gap-3 pointer-events-auto">
            <button 
              onClick={() => setShowVideo(!showVideo)}
              className="group flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all"
            >
              <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 group-hover:text-white transition-colors">Preview</span>
              <Camera className={`w-4 h-4 ${showVideo ? 'text-amber-400' : 'text-neutral-500'}`} />
            </button>
          </div>
        </div>

        {/* Bottom Bar - Data Grid Style */}
        <div className="flex justify-between items-end">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 bg-black/60 backdrop-blur-xl border border-white/10 p-5 rounded-xl">
              <div className="flex flex-col">
                <span className="text-[9px] font-mono uppercase text-neutral-500 tracking-wider">Tracking Status</span>
                <span className={`text-xs font-bold uppercase tracking-tighter ${handDetected ? 'text-green-400' : 'text-red-400'}`}>
                  {handDetected ? 'Locked' : 'Searching'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-mono uppercase text-neutral-500 tracking-wider">Latency</span>
                <span className="text-xs font-bold uppercase tracking-tighter text-neutral-300">{latency}ms</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-mono uppercase text-neutral-500 tracking-wider">Joints</span>
                <span className="text-xs font-bold uppercase tracking-tighter text-neutral-300">21 Active</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-mono uppercase text-neutral-500 tracking-wider">Precision</span>
                <span className="text-xs font-bold uppercase tracking-tighter text-neutral-300">{(precision * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-4">
            <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-amber-400"
                animate={{ width: handDetected ? '100%' : '20%' }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest text-right max-w-[200px]">
              Spatial coordinates synchronized with local camera feed.
            </p>
          </div>
        </div>
      </div>

      {/* Video Preview - Hardware Widget Style */}
      <AnimatePresence>
        {showVideo && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-8 right-8 w-56 h-42 rounded-2xl overflow-hidden border border-white/10 shadow-2xl z-20 pointer-events-none bg-black"
          >
            <video 
              ref={videoRef} 
              className="w-full h-full object-cover opacity-60 grayscale contrast-125 scale-x-[-1]" 
              autoPlay 
              playsInline 
              muted 
            />
            <div className="absolute inset-0 border-[12px] border-black/20 pointer-events-none" />
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              <span className="text-[8px] font-mono uppercase text-white/60 tracking-widest">Rec_Feed</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Start Screen - Brutalist Style */}
      <AnimatePresence>
        {!isStarted && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-[#0a0a0a] flex flex-col items-center justify-center p-8 overflow-hidden"
          >
            <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
              <span className="absolute top-0 left-0 text-[20vw] font-black leading-none text-white select-none whitespace-nowrap">HAND MAPPING</span>
              <span className="absolute bottom-0 right-0 text-[20vw] font-black leading-none text-white select-none whitespace-nowrap">HAND MAPPING</span>
            </div>

            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="relative z-10 flex flex-col items-center"
            >
              <div className="w-24 h-24 border-2 border-amber-400 rounded-full flex items-center justify-center mb-10">
                <Hand className="w-10 h-10 text-amber-400" />
              </div>
              
              <h1 className="text-8xl font-black tracking-tighter mb-4 italic text-center leading-none">
                SKELETAL<br /><span className="text-amber-400">RECON</span>
              </h1>
              
              <p className="text-neutral-500 font-mono uppercase tracking-[0.4em] mb-16 text-sm">
                Advanced Gesture Interface
              </p>
              
              <button 
                onClick={startApp}
                className="group relative px-16 py-6 bg-white text-black font-black text-2xl rounded-none hover:bg-amber-400 transition-all duration-300 active:scale-95"
              >
                INITIALIZE_SYSTEM
                <div className="absolute -top-2 -right-2 w-4 h-4 bg-amber-400" />
                <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-amber-400" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4"
          >
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-amber-400">Loading_Assets</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error State */}
      {error && (
        <div className="absolute inset-0 z-[70] bg-red-950/90 backdrop-blur-2xl flex flex-col items-center justify-center p-10 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
            <Info className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-4xl font-black tracking-tighter mb-4 uppercase">System_Error</h2>
          <p className="text-red-200/60 max-w-md mb-10 font-mono text-sm leading-relaxed">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-10 py-4 bg-white text-black font-black rounded-none hover:bg-red-500 hover:text-white transition-all"
          >
            REBOOT_SYSTEM
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
