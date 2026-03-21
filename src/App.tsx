import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Hand, Info, Loader2, Maximize2, Minimize2, Settings } from 'lucide-react';

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

const SKIN_COLOR = 0xffdbac; // Light skin tone
const JOINT_COLOR = 0xf1c27d; // Slightly darker for joints

const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isStarted, setIsStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState(true);
  const [handDetected, setHandDetected] = useState(false);

  // Three.js Refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const jointsRef = useRef<THREE.Mesh[]>([]);
  const bonesRef = useRef<THREE.Mesh[]>([]);

  const startApp = async () => {
    setIsStarted(true);
    setIsLoading(true);
    initMediaPipe();
  };

  const initMediaPipe = async () => {
    try {
      if (!window.Hands || !window.Camera) {
        // Wait a bit for scripts to load if they haven't yet
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
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      hands.onResults((results: any) => {
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          setHandDetected(true);
          const landmarks = results.multiHandLandmarks[0];

          // Update Joints
          landmarks.forEach((lm: any, i: number) => {
            const joint = jointsRef.current[i];
            const x = (lm.x - 0.5) * 150;
            const y = -(lm.y - 0.5) * 150;
            const z = -lm.z * 150;

            joint.position.set(x, y, z);
            joint.visible = true;
          });

          // Update Bones
          HAND_CONNECTIONS.forEach((conn, i) => {
            const bone = bonesRef.current[i];
            const start = jointsRef.current[conn[0]].position;
            const end = jointsRef.current[conn[1]].position;

            const distance = start.distanceTo(end);
            bone.scale.set(1, distance, 1);
            bone.position.copy(start).lerp(end, 0.5);
            bone.quaternion.setFromUnitVectors(
              new THREE.Vector3(0, 1, 0),
              end.clone().sub(start).normalize()
            );
            bone.visible = true;
          });
        } else {
          setHandDetected(false);
          jointsRef.current.forEach(j => j.visible = false);
          bonesRef.current.forEach(b => b.visible = false);
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
        setError("Camera access was denied. Please click the camera icon in your browser's address bar to allow access and refresh the page.");
      } else {
        setError(err.message || "Failed to initialize camera or hand tracking.");
      }
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 100);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(50, 50, 100);
    scene.add(pointLight);

    const backLight = new THREE.PointLight(0xffffff, 0.5);
    backLight.position.set(-50, -50, -50);
    scene.add(backLight);

    // --- Hand Model Creation ---
    const jointGeometry = new THREE.SphereGeometry(1.8, 16, 16);
    const jointMaterial = new THREE.MeshStandardMaterial({ color: JOINT_COLOR, roughness: 0.3, metalness: 0.1 });

    const boneMaterial = new THREE.MeshStandardMaterial({ color: SKIN_COLOR, roughness: 0.4, metalness: 0.05 });

    // Create 21 joints
    for (let i = 0; i < 21; i++) {
      const joint = new THREE.Mesh(jointGeometry, jointMaterial);
      joint.visible = false;
      scene.add(joint);
      jointsRef.current.push(joint);
    }

    // Create bones
    HAND_CONNECTIONS.forEach(() => {
      const boneGeometry = new THREE.CylinderGeometry(1.2, 1.2, 1, 12);
      const bone = new THREE.Mesh(boneGeometry, boneMaterial);
      bone.visible = false;
      scene.add(bone);
      bonesRef.current.push(bone);
    });

    // --- Animation Loop ---
    const animate = () => {
      requestAnimationFrame(animate);
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
      renderer.dispose();
      if (containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-screen bg-neutral-950 font-sans text-white overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(30,30,30,1)_0%,_rgba(0,0,0,1)_100%)]" />

      {/* Three.js Container */}
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* UI Overlay */}
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-8 z-10">
        {/* Top Bar */}
        <div className="flex justify-between items-start">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col"
          >
            <h1 className="text-4xl font-bold tracking-tighter flex items-center gap-3">
              <Hand className="w-8 h-8 text-amber-400" />
              EMOJI HAND <span className="text-xs font-mono bg-amber-400/10 text-amber-400 px-2 py-1 rounded border border-amber-400/20">v2.0</span>
            </h1>
            <p className="text-neutral-500 text-sm mt-1 font-mono uppercase tracking-widest">Real-time 3D Skeletal Mapping</p>
          </motion.div>

          <div className="flex gap-4 pointer-events-auto">
            <button 
              onClick={() => setShowVideo(!showVideo)}
              className="p-3 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-colors"
              title="Toggle Camera Preview"
            >
              <Camera className={`w-5 h-5 ${showVideo ? 'text-amber-400' : 'text-white'}`} />
            </button>
            <button className="p-3 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex justify-between items-end">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md border border-white/5 p-4 rounded-2xl">
              <div className={`w-2 h-2 rounded-full ${handDetected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-xs font-mono uppercase tracking-tighter">
                {handDetected ? 'Hand Tracked' : 'Searching for Hand...'}
              </span>
            </div>
          </div>

          <div className="bg-black/40 backdrop-blur-md border border-white/5 p-4 rounded-2xl max-w-xs">
            <div className="flex items-start gap-3">
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[10px] leading-relaxed text-neutral-400 uppercase tracking-wider">
                Move your hand in front of the camera. The 3D model will mirror your movements including finger articulation.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Video Preview */}
      <AnimatePresence>
        {showVideo && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute bottom-8 right-8 w-48 h-36 rounded-2xl overflow-hidden border-2 border-amber-400/30 shadow-2xl z-20 pointer-events-none"
          >
            <video 
              ref={videoRef} 
              className="w-full h-full object-cover mirror scale-x-[-1]" 
              autoPlay 
              playsInline 
              muted 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2">
              <span className="text-[8px] font-mono uppercase">Live Feed</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Start Screen */}
      <AnimatePresence>
        {!isStarted && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-neutral-950 flex flex-col items-center justify-center p-8 text-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="max-w-2xl"
            >
              <Hand className="w-20 h-20 text-amber-400 mx-auto mb-8 animate-bounce" />
              <h1 className="text-6xl font-black tracking-tighter mb-4 italic">
                EMOJI HAND <span className="text-amber-400">3D</span>
              </h1>
              <p className="text-neutral-400 text-lg mb-12 font-mono uppercase tracking-[0.2em]">
                Immersive Gesture Mapping Experience
              </p>
              
              <button 
                onClick={startApp}
                className="group relative px-12 py-5 bg-white text-black font-black text-xl rounded-full hover:bg-amber-400 transition-all duration-300 hover:scale-105 active:scale-95 pointer-events-auto"
              >
                <span className="relative z-10">ENTER UNIVERSE</span>
                <div className="absolute inset-0 rounded-full bg-white blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
              </button>
              
              <p className="mt-8 text-[10px] text-neutral-600 uppercase tracking-widest">
                Camera Access Required for Real-time Tracking
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State */}
      <AnimatePresence>
        {isLoading && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-neutral-950 flex flex-col items-center justify-center gap-6"
          >
            <div className="relative">
              <Loader2 className="w-12 h-12 text-amber-400 animate-spin" />
              <div className="absolute inset-0 blur-xl bg-amber-400/20 animate-pulse" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold tracking-widest uppercase">Initializing Universe</h2>
              <p className="text-neutral-500 text-xs mt-2 font-mono">Calibrating Hand Tracking Sensors...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error State */}
      {error && (
        <div className="absolute inset-0 z-[60] bg-red-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Connection Failed</h2>
          <p className="text-red-200 max-w-md mb-8">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-white text-black font-bold rounded-full hover:bg-neutral-200 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
