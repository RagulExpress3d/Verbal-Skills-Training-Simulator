import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAnimations, useGLTF, PerspectiveCamera, Html } from '@react-three/drei';
import * as THREE from 'three';

interface AvatarProps {
  position: [number, number, number];
  rotation: [number, number, number];
  color: string;
  isSpeaking?: boolean;
  isDistressed?: boolean;
  label: string;
  type: 'patient' | 'nurse' | 'attending';
}

export const Avatar: React.FC<AvatarProps> = ({ 
  position, 
  rotation, 
  color, 
  isSpeaking, 
  isDistressed, 
  label,
  type 
}) => {
  const group = useRef<THREE.Group>(null);
  const head = useRef<THREE.Mesh>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const body = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    
    // Subtle breathing
    if (body.current) {
      body.current.scale.y = 1 + Math.sin(t * 1.5) * 0.01;
      if (isDistressed) {
        body.current.scale.y = 1 + Math.sin(t * 3) * 0.02; // Faster breathing
      }
    }

    // Speaking animation
    if (mouth.current && isSpeaking) {
      mouth.current.scale.y = 0.5 + Math.sin(t * 15) * 0.5;
    } else if (mouth.current) {
      mouth.current.scale.y = 0.1;
    }

    // Idle sway
    if (group.current) {
      group.current.rotation.y = rotation[1] + Math.sin(t * 0.5) * 0.02;
    }
  });

  return (
    <group ref={group} position={position} rotation={rotation}>
      {/* Body */}
      <group ref={body}>
        <mesh position={[0, 0.75, 0]}>
          <capsuleGeometry args={[0.25, 1, 4, 8]} />
          <meshStandardMaterial color={color} />
        </mesh>
      </group>

      {/* Head */}
      <mesh ref={head} position={[0, 1.6, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#ffdbac" />
        
        {/* Mouth */}
        <mesh ref={mouth} position={[0, -0.05, 0.18]}>
          <boxGeometry args={[0.1, 0.05, 0.02]} />
          <meshStandardMaterial color="#440000" />
        </mesh>

        {/* Eyes */}
        <mesh position={[-0.07, 0.05, 0.17]}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshStandardMaterial color="black" />
        </mesh>
        <mesh position={[0.07, 0.05, 0.17]}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshStandardMaterial color="black" />
        </mesh>
      </mesh>

      {/* Label */}
      <Html position={[0, 2, 0]} center>
        <div className="bg-black/50 text-white px-2 py-0.5 rounded text-xs whitespace-nowrap pointer-events-none">
          {label}
        </div>
      </Html>
    </group>
  );
};

export const ERRoom = () => {
  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#e5e7eb" />
      </mesh>

      {/* Walls */}
      <mesh position={[0, 2.5, -5]}>
        <boxGeometry args={[10, 5, 0.1]} />
        <meshStandardMaterial color="#f3f4f6" />
      </mesh>
      <mesh position={[-5, 2.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[10, 5, 0.1]} />
        <meshStandardMaterial color="#f3f4f6" />
      </mesh>

      {/* Hospital Bed */}
      <group position={[2, 0, -2]}>
        {/* Frame */}
        <mesh position={[0, 0.4, 0]}>
          <boxGeometry args={[1.2, 0.2, 2.2]} />
          <meshStandardMaterial color="#9ca3af" />
        </mesh>
        {/* Mattress */}
        <mesh position={[0, 0.6, 0]}>
          <boxGeometry args={[1.1, 0.2, 2.1]} />
          <meshStandardMaterial color="white" />
        </mesh>
        {/* Headboard */}
        <mesh position={[0, 0.8, -1.05]}>
          <boxGeometry args={[1.2, 0.8, 0.1]} />
          <meshStandardMaterial color="#9ca3af" />
        </mesh>
      </group>

      {/* Monitor */}
      <group position={[3.5, 0, -3]}>
        <mesh position={[0, 0.8, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 1.6]} />
          <meshStandardMaterial color="#4b5563" />
        </mesh>
        <mesh position={[0, 1.4, 0.1]} rotation={[0, -0.5, 0]}>
          <boxGeometry args={[0.6, 0.4, 0.1]} />
          <meshStandardMaterial color="#1f2937" />
          {/* Screen glow */}
          <pointLight position={[0, 0, 0.2]} intensity={0.5} color="#00ff00" distance={2} />
        </mesh>
      </group>

      {/* IV Pole */}
      <group position={[0.5, 0, -3]}>
        <mesh position={[0, 1.1, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 2.2]} />
          <meshStandardMaterial color="#d1d5db" />
        </mesh>
        <mesh position={[0, 2, 0]}>
          <boxGeometry args={[0.4, 0.02, 0.02]} />
          <meshStandardMaterial color="#d1d5db" />
        </mesh>
      </group>

      {/* Stool */}
      <group position={[3.5, 0, -1]}>
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.1]} />
          <meshStandardMaterial color="#4b5563" />
        </mesh>
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.5]} />
          <meshStandardMaterial color="#9ca3af" />
        </mesh>
        <mesh position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.05]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
      </group>

      {/* Wall Medical Panel */}
      <group position={[2, 1.8, -4.94]}>
        <mesh>
          <boxGeometry args={[2, 1.2, 0.1]} />
          <meshStandardMaterial color="#e5e7eb" />
        </mesh>
        {/* Outlets/Gauges */}
        <mesh position={[-0.6, 0.2, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.05]} />
          <meshStandardMaterial color="#10b981" /> {/* Oxygen */}
        </mesh>
        <mesh position={[-0.6, -0.2, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.05]} />
          <meshStandardMaterial color="#ef4444" /> {/* Suction */}
        </mesh>
        <mesh position={[0.4, 0, 0.06]}>
          <boxGeometry args={[0.8, 0.6, 0.05]} />
          <meshStandardMaterial color="#9ca3af" />
        </mesh>
      </group>

      {/* Curtains */}
      <mesh position={[4.9, 1.5, 0]}>
        <boxGeometry args={[0.05, 3, 6]} />
        <meshStandardMaterial color="#bfdbfe" transparent opacity={0.6} />
      </mesh>

      {/* Lights */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} castShadow />
      <rectAreaLight
        width={4}
        height={4}
        intensity={2}
        color="white"
        position={[0, 4.5, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      />
    </group>
  );
};
