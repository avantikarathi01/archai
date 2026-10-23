import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  DEFAULT_WALL_HEIGHT,
  CUTAWAY_WALL_HEIGHT,
  WALL_THICKNESS,
  convert2DTo3DCoords,
  getFloorElevation,
  generateRoomWallSegments,
  generateStairSteps,
  generateOpeningPlacements,
  generateRoomFurniture,
  calculateLabelSpecs,
  calculateOptimalCameraPosition,
  LIGHTING_PRESETS,
  MATERIAL_STYLES,
  QUALITY_PRESETS,
  calculateRevealState,
  ARCHITECTURAL_PALETTE
} from '../../utils/threeMath';
import { generatePropertySite } from '../../utils/propertyGenerator';
import { getDesignConcept } from '../../utils/designConcepts';
import { FirstPersonController } from '../../utils/FirstPersonController';

/**
 * Creates a floating 3D text sprite using an offscreen 2D canvas
 */
function createRoomTextSprite(title, subtitle = '', color = '#38bdf8', isSelected = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 110;
  const ctx = canvas.getContext('2d');

  // Background rounded card
  ctx.fillStyle = isSelected ? 'rgba(8, 47, 73, 0.96)' : 'rgba(15, 23, 42, 0.88)';
  ctx.strokeStyle = isSelected ? '#38bdf8' : color;
  ctx.lineWidth = isSelected ? 4 : 2;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(6, 6, 244, 98, 12);
  } else {
    ctx.rect(6, 6, 244, 98);
  }
  ctx.fill();
  ctx.stroke();

  // Room Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 128, 38);

  // Subtitle (dimensions)
  if (subtitle) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '15px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(subtitle, 128, 72);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: true,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.userData = { isSprite: true, texture, material: spriteMaterial };
  return sprite;
}

/**
 * Helper to recursively dispose geometries, materials, and textures in a group
 */
function disposeGroup(group) {
  if (!group) return;
  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
    if (child.userData?.texture) child.userData.texture.dispose();
    if (child.userData?.material) child.userData.material.dispose();
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
      else child.material.dispose();
    }
    if (child.children && child.children.length > 0) {
      disposeGroup(child);
    }
  }
}

export default function Canvas3D({
  rooms = [],
  plot = { width: 30, length: 40, isDimensionsExplicit: true },
  facing = 'East',
  floorMode = 'all', // 'all' | 'ground' | 'first' | 'cutaway' | 'exploded' | 'topdown' | 'exterior'
  explodedGap = 8,
  cameraPreset = 'iso', // 'iso' | 'top' | 'front' | 'frame' | 'exterior'
  cameraPresetTrigger = 0,
  wallHeightMode = 'cutaway', // 'cutaway' | 'full'
  showFurniture = true,
  showLabels = true,
  lightingPreset = 'warm_daylight',
  materialStyle = 'modern_scandi',
  qualityPreset = 'balanced',
  // Reveal animation
  isRevealing = false,
  revealProgress = 0,
  // Walkthrough mode
  isWalkthrough = false,
  walkthroughWaypoint = null,
  selectedRoomId = null,
  onSelectRoom = null,
  onHoverRoom = null,
  // Phase 6 Simulator Props
  isSimulator = false,
  teleportTargetRoom = null,
  designConcept = 'contemporary_minimalist',
  lightsOn = true,
  onInteractionChange = null,
  onFurnitureInspect = null,
  onFloorChange = null,
  onExitSimulator = null,
  onToggleLights = null,
  virtualMovement = null
}) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const lightsRef = useRef({});
  const interiorLightsGroupRef = useRef(null);
  const exteriorLightsGroupRef = useRef(null);
  const buildingGroupRef = useRef(null);
  const groundGroupRef = useRef(null);
  const propertyGroupRef = useRef(null);
  const animationFrameIdRef = useRef(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());

  // Interactive room meshes dictionary for raycasting
  const roomMeshesRef = useRef([]);

  // Phase 6 physics & simulator refs
  const doorsRef = useRef([]);
  const collisionBoxesRef = useRef([]);
  const furnitureMeshesRef = useRef([]);
  const fpsControllerRef = useRef(null);
  const isSimulatorRef = useRef(isSimulator);
  isSimulatorRef.current = isSimulator;

  // Animation interpolation targets
  const targetCameraPosRef = useRef(null);
  const targetLookAtRef = useRef(null);

  // Walkthrough & Camera Transition Reference
  const walkthroughTransitionRef = useRef(null);
  const wasWalkthroughRef = useRef(false);

  // References for zero-allocation reveal animation
  const groundSlabMeshRef = useRef(null);
  const level0WallsGroupRef = useRef(null);
  const level0FurnitureGroupRef = useRef(null);
  const level1GroupRef = useRef(null);

  const plotWidth = plot.width || 30;
  const plotLength = plot.length || 40;

  // Frame Camera Helper
  const frameCamera = (preset = cameraPreset) => {
    if (!cameraRef.current || !controlsRef.current) return;
    const { position, target } = calculateOptimalCameraPosition(
      plotWidth,
      plotLength,
      floorMode,
      explodedGap,
      preset,
      facing
    );

    targetCameraPosRef.current = new THREE.Vector3(position.x, position.y, position.z);
    targetLookAtRef.current = new THREE.Vector3(target.x, target.y, target.z);
  };

  // Camera Preset & Orientation Transition Trigger
  useEffect(() => {
    if (!isSimulatorRef.current) {
      frameCamera(cameraPreset);
    }
  }, [cameraPreset, cameraPresetTrigger, floorMode, explodedGap, facing]);

  // Teleport player in First-Person Simulator Mode
  useEffect(() => {
    if (!teleportTargetRoom || !fpsControllerRef.current || !isSimulatorRef.current) return;
    if (teleportTargetRoom.isSpawn) {
      const site = generatePropertySite(plotWidth, plotLength, rooms, facing, designConcept);
      fpsControllerRef.current.teleport(
        site.spawnPoint.x,
        site.spawnPoint.y,
        site.spawnPoint.z,
        site.spawnPoint.yaw,
        site.spawnPoint.pitch
      );
    } else {
      fpsControllerRef.current.teleportToRoom(teleportTargetRoom, plotWidth, plotLength);
    }
  }, [teleportTargetRoom]);

  // 1. Initialize Three.js Viewport, Camera, Lights, and Render Loop
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // A. Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d12);
    sceneRef.current = scene;

    // B. Camera with refined 38° architectural field-of-view
    const camera = new THREE.PerspectiveCamera(
      38,
      container.clientWidth / container.clientHeight,
      0.1,
      800
    );
    cameraRef.current = camera;

    // C. Renderer
    const q = QUALITY_PRESETS[qualityPreset] || QUALITY_PRESETS.balanced;
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.pixelRatioMax));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = q.pcfSoft ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // D. OrbitControls (Studio Overview Mode)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = 3;
    controls.maxDistance = 250;
    controlsRef.current = controls;

    // Initial camera placement with cinematic crane entrance sweep
    const { position, target } = calculateOptimalCameraPosition(plotWidth, plotLength, floorMode, explodedGap, cameraPreset);
    camera.position.set(position.x * 1.35, position.y * 1.55, position.z * 1.35);
    controls.target.set(target.x, target.y + 3, target.z);
    controls.update();

    // Smoothly glide into optimal beauty angle
    targetCameraPosRef.current = new THREE.Vector3(position.x, position.y, position.z);
    targetLookAtRef.current = new THREE.Vector3(target.x, target.y, target.z);

    // E. Lighting System
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.4);
    sunLight.position.set(35, 55, 40);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = q.shadowMapSize;
    sunLight.shadow.mapSize.height = q.shadowMapSize;
    const sBox = Math.max(plotWidth, plotLength) * 1.8;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 180;
    sunLight.shadow.camera.left = -sBox;
    sunLight.shadow.camera.right = sBox;
    sunLight.shadow.camera.top = sBox;
    sunLight.shadow.camera.bottom = -sBox;
    sunLight.shadow.bias = -0.0003;
    scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x1e293b, 0.45);
    scene.add(hemiLight);

    lightsRef.current = { ambientLight, sunLight, hemiLight };

    // Group for interior warm point lights
    const interiorLightsGroup = new THREE.Group();
    scene.add(interiorLightsGroup);
    interiorLightsGroupRef.current = interiorLightsGroup;

    // Group for exterior lighting (gate lanterns, bollards, porch spots)
    const exteriorLightsGroup = new THREE.Group();
    scene.add(exteriorLightsGroup);
    exteriorLightsGroupRef.current = exteriorLightsGroup;

    // Groups for building, ground, and property
    const groundGroup = new THREE.Group();
    scene.add(groundGroup);
    groundGroupRef.current = groundGroup;

    const propertyGroup = new THREE.Group();
    scene.add(propertyGroup);
    propertyGroupRef.current = propertyGroup;

    const buildingGroup = new THREE.Group();
    scene.add(buildingGroup);
    buildingGroupRef.current = buildingGroup;

    // F. Render Loop with Smooth Camera, Walkthrough Glide, and Phase 6 FPS Simulation
    let lastTime = performance.now();
    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);

      const now = performance.now();
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      // 1. Animated Doors & Gates Rotation (Smooth Spring Interpolation)
      if (doorsRef.current.length > 0) {
        doorsRef.current.forEach(door => {
          if (door.pivotMesh) {
            door.currentAngle = THREE.MathUtils.lerp(door.currentAngle, door.targetAngle, dt * 7.5);
            door.pivotMesh.rotation.y = door.currentAngle;
          }
          if (door.pivotLeft && door.pivotRight) {
            door.currentAngle = THREE.MathUtils.lerp(door.currentAngle, door.targetAngle, dt * 6.5);
            door.pivotLeft.rotation.y = door.currentAngle;
            door.pivotRight.rotation.y = -door.currentAngle;
          }
        });
      }

      // 2. Active Mode Dispatch (Simulator vs Walkthrough vs OrbitControls)
      if (isSimulatorRef.current && fpsControllerRef.current) {
        // Direct first-person user movement & physics
        fpsControllerRef.current.update(dt);
      } else if (walkthroughTransitionRef.current && cameraRef.current && controlsRef.current) {
        // Walkthrough Smooth Camera Transition
        const trans = walkthroughTransitionRef.current;
        const elapsed = now - trans.startTime;
        const t = Math.min(1.0, elapsed / trans.duration);
        const easeT = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        cameraRef.current.position.lerpVectors(trans.startPos, trans.endPos, easeT);
        controlsRef.current.target.lerpVectors(trans.startTarget, trans.endTarget, easeT);

        controlsRef.current.enabled = false;

        if (t >= 1.0) {
          controlsRef.current.target.copy(trans.endTarget);
          cameraRef.current.position.copy(trans.endPos);
          controlsRef.current.enabled = true;

          if (trans.isExiting) {
            controlsRef.current.minDistance = 3;
            controlsRef.current.maxDistance = 250;
            controlsRef.current.maxPolarAngle = Math.PI / 2 - 0.02;
            controlsRef.current.minPolarAngle = 0.05;
          } else {
            controlsRef.current.minDistance = 0.2;
            controlsRef.current.maxDistance = 25.0;
            controlsRef.current.maxPolarAngle = Math.PI - 0.08;
            controlsRef.current.minPolarAngle = 0.08;
          }
          controlsRef.current.update();
          walkthroughTransitionRef.current = null;
        }
      } else if (targetCameraPosRef.current && cameraRef.current && controlsRef.current) {
        // Standard preset camera change
        cameraRef.current.position.lerp(targetCameraPosRef.current, dt * 5.0);
        controlsRef.current.target.lerp(targetLookAtRef.current, dt * 5.0);

        if (cameraRef.current.position.distanceTo(targetCameraPosRef.current) < 0.15) {
          cameraRef.current.position.copy(targetCameraPosRef.current);
          controlsRef.current.target.copy(targetLookAtRef.current);
          targetCameraPosRef.current = null;
          targetLookAtRef.current = null;
        }
      } else if (controlsRef.current) {
        controlsRef.current.update();
      }

      renderer.render(scene, camera);
    };
    animate();

    // G. Resize Observer
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      resizeObserver.disconnect();
      if (fpsControllerRef.current) {
        fpsControllerRef.current.detach();
        fpsControllerRef.current = null;
      }
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // 2. Respond to Quality Preset Changes
  useEffect(() => {
    const renderer = rendererRef.current;
    const { sunLight } = lightsRef.current;
    if (!renderer || !sunLight) return;

    const q = QUALITY_PRESETS[qualityPreset] || QUALITY_PRESETS.balanced;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.pixelRatioMax));
    renderer.shadowMap.type = q.pcfSoft ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
    sunLight.shadow.mapSize.width = q.shadowMapSize;
    sunLight.shadow.mapSize.height = q.shadowMapSize;
    if (sunLight.shadow.map) {
      sunLight.shadow.map.dispose();
      sunLight.shadow.map = null;
    }
  }, [qualityPreset]);

  // 3. Respond to Lighting Preset Changes
  useEffect(() => {
    const { sunLight, hemiLight } = lightsRef.current;
    const renderer = rendererRef.current;
    if (!sunLight || !hemiLight || !renderer) return;

    const preset = LIGHTING_PRESETS[lightingPreset] || LIGHTING_PRESETS.warm_daylight;

    sunLight.color.set(preset.sunColor);
    sunLight.intensity = preset.sunIntensity;
    sunLight.position.set(...preset.sunPosition);

    hemiLight.color.set(preset.hemiSky);
    hemiLight.groundColor.set(preset.hemiGround);
    hemiLight.intensity = preset.hemiIntensity;

    renderer.toneMappingExposure = preset.exposure;
  }, [lightingPreset]);

  // 4. Respond to Lights Toggle (F Key or UI Switch)
  useEffect(() => {
    if (interiorLightsGroupRef.current) {
      interiorLightsGroupRef.current.visible = lightsOn;
    }
    if (exteriorLightsGroupRef.current) {
      exteriorLightsGroupRef.current.visible = lightsOn;
    }
  }, [lightsOn]);

  // 5. Build Complete Property Site (Boundary Wall, Pillars, Gates, Driveway, Landscaping, Lights)
  useEffect(() => {
    const group = propertyGroupRef.current;
    const groundGroup = groundGroupRef.current;
    const extLightsGroup = exteriorLightsGroupRef.current;
    if (!group || !groundGroup) return;

    disposeGroup(group);
    disposeGroup(groundGroup);
    if (extLightsGroup) {
      while (extLightsGroup.children.length > 0) {
        extLightsGroup.remove(extLightsGroup.children[0]);
      }
    }

    const site = generatePropertySite(plotWidth, plotLength, rooms, facing, designConcept);
    const concept = site.concept;

    // A. Grid & Terrain
    const grid = new THREE.GridHelper(140, 70, ARCHITECTURAL_PALETTE.gridLines, 0x111927);
    grid.position.y = -0.06;
    groundGroup.add(grid);

    // Site Ground Foundation
    const siteBounds = site.bounds;
    const groundGeo = new THREE.BoxGeometry(siteBounds.siteWidth + 12, 0.4, siteBounds.siteLength + 14);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.95,
      metalness: 0.05
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.set(0, -0.22, siteBounds.siteCenterZ);
    groundMesh.receiveShadow = true;
    groundGroup.add(groundMesh);

    // B. Garden Lawns (Emerald / Olive / Forest Green depending on concept)
    const lawnMat = new THREE.MeshStandardMaterial({
      color: concept.grassColor,
      roughness: 0.88,
      metalness: 0.02
    });

    site.lawns.forEach(l => {
      const lawnGeo = new THREE.BoxGeometry(l.width, 0.1, l.length);
      const lawnMesh = new THREE.Mesh(lawnGeo, lawnMat);
      lawnMesh.position.set(l.x, l.y, l.z);
      lawnMesh.receiveShadow = true;
      group.add(lawnMesh);
    });

    // C. Paved Driveway and Walkway (Matching concept paver tones)
    const paverMat = new THREE.MeshStandardMaterial({
      color: concept.pavingColor,
      roughness: 0.75,
      metalness: 0.1
    });

    const drivewayGeo = new THREE.BoxGeometry(site.driveway.width, 0.12, site.driveway.length);
    const drivewayMesh = new THREE.Mesh(drivewayGeo, paverMat);
    drivewayMesh.position.set(site.driveway.x, site.driveway.y, site.driveway.z);
    drivewayMesh.receiveShadow = true;
    group.add(drivewayMesh);

    const walkwayGeo = new THREE.BoxGeometry(site.walkway.width, 0.14, site.walkway.length);
    const walkwayMesh = new THREE.Mesh(walkwayGeo, paverMat);
    walkwayMesh.position.set(site.walkway.x, site.walkway.y, site.walkway.z);
    walkwayMesh.receiveShadow = true;
    group.add(walkwayMesh);

    // D. Boundary Compound Walls with Coping
    const wallMat = new THREE.MeshStandardMaterial({
      color: concept.boundaryWallColor,
      roughness: 0.85,
      metalness: 0.04
    });

    const copingMat = new THREE.MeshStandardMaterial({
      color: concept.copingColor,
      roughness: 0.6,
      metalness: 0.2
    });

    site.boundaryWalls.forEach(bw => {
      if (bw.width > 0.5) {
        const bwGeo = new THREE.BoxGeometry(bw.width, bw.height, bw.length);
        const bwMesh = new THREE.Mesh(bwGeo, wallMat);
        bwMesh.position.set(bw.x, bw.y, bw.z);
        bwMesh.castShadow = true;
        bwMesh.receiveShadow = true;
        group.add(bwMesh);

        // Top Coping Slab
        const copingGeo = new THREE.BoxGeometry(
          bw.width === bw.length ? bw.width : (bw.width > bw.length ? bw.width + 0.3 : bw.width + 0.3),
          0.35,
          bw.length > bw.width ? bw.length + 0.3 : bw.length + 0.3
        );
        const copingMesh = new THREE.Mesh(copingGeo, copingMat);
        copingMesh.position.set(bw.x, bw.y + bw.height / 2 + 0.17, bw.z);
        copingMesh.castShadow = true;
        group.add(copingMesh);
      }
    });

    // E. Gate Pillars with Illuminated Lanterns
    const pillarMat = new THREE.MeshStandardMaterial({
      color: concept.facadeAccentColor,
      roughness: 0.7,
      metalness: 0.1
    });

    site.pillars.forEach(p => {
      const pGeo = new THREE.BoxGeometry(p.width, p.height, p.length);
      const pMesh = new THREE.Mesh(pGeo, pillarMat);
      pMesh.position.set(p.x, p.y, p.z);
      pMesh.castShadow = true;
      pMesh.receiveShadow = true;
      group.add(pMesh);

      // Pyramidal Cap
      const capGeo = new THREE.ConeGeometry(p.width * 0.75, 0.8, 4);
      const capMesh = new THREE.Mesh(capGeo, copingMat);
      capMesh.position.set(p.x, p.height + 0.4, p.z);
      capMesh.rotation.y = Math.PI / 4;
      group.add(capMesh);

      // Lantern Light Housing
      const lanternGeo = new THREE.BoxGeometry(0.8, 1.0, 0.8);
      const lanternMat = new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xfef08a,
        emissiveIntensity: 0.6,
        roughness: 0.2
      });
      const lanternMesh = new THREE.Mesh(lanternGeo, lanternMat);
      lanternMesh.position.set(p.x, p.height + 1.2, p.z);
      group.add(lanternMesh);

      if (extLightsGroup) {
        const pLight = new THREE.PointLight(0xffedd5, 1.2, 18, 2);
        pLight.position.set(p.x, p.height + 1.4, p.z);
        extLightsGroup.add(pLight);
      }
    });

    // F. Interactive Vehicular & Pedestrian Gates
    const gateMat = new THREE.MeshStandardMaterial({
      color: concept.gateColor,
      roughness: 0.5,
      metalness: 0.65
    });

    // 1. Vehicular Gate (Double leaf with left and right hinge pivots)
    const vehGate = site.gates[0];
    const leafW = vehGate.width / 2;

    const vehPivotLeft = new THREE.Group();
    vehPivotLeft.position.set(vehGate.hingeLeftX, vehGate.y, vehGate.z);
    const leafLeftGeo = new THREE.BoxGeometry(leafW, vehGate.height, vehGate.thickness);
    const leafLeftMesh = new THREE.Mesh(leafLeftGeo, gateMat);
    leafLeftMesh.position.set(leafW / 2, 0, 0);
    leafLeftMesh.castShadow = true;
    vehPivotLeft.add(leafLeftMesh);
    group.add(vehPivotLeft);

    const vehPivotRight = new THREE.Group();
    vehPivotRight.position.set(vehGate.hingeRightX, vehGate.y, vehGate.z);
    const leafRightGeo = new THREE.BoxGeometry(leafW, vehGate.height, vehGate.thickness);
    const leafRightMesh = new THREE.Mesh(leafRightGeo, gateMat);
    leafRightMesh.position.set(-leafW / 2, 0, 0);
    leafRightMesh.castShadow = true;
    vehPivotRight.add(leafRightMesh);
    group.add(vehPivotRight);

    // Collision box for vehicular gate
    const vehColBox = {
      id: 'gate_vehicular_col',
      type: 'gate',
      minX: vehGate.x - vehGate.width / 2,
      maxX: vehGate.x + vehGate.width / 2,
      minZ: vehGate.z - 0.5,
      maxZ: vehGate.z + 0.5,
      minY: 0,
      maxY: vehGate.height,
      disabled: false
    };

    const vehGateEntry = {
      id: vehGate.id,
      name: vehGate.name,
      isOpen: false,
      position: new THREE.Vector3(vehGate.x, vehGate.y, vehGate.z),
      pivotLeft: vehPivotLeft,
      pivotRight: vehPivotRight,
      targetAngle: 0,
      currentAngle: 0,
      collisionBox: vehColBox,
      onToggle: () => {
        vehGateEntry.isOpen = !vehGateEntry.isOpen;
        vehGateEntry.targetAngle = vehGateEntry.isOpen ? Math.PI / 2 : 0;
        vehColBox.disabled = vehGateEntry.isOpen;
        if (onInteractionChange) {
          onInteractionChange({
            name: vehGateEntry.name,
            isOpen: vehGateEntry.isOpen,
            onToggle: vehGateEntry.onToggle
          });
        }
      }
    };

    // 2. Pedestrian Gate (Single leaf with hinge pivot)
    const pedGate = site.gates[1];
    const pedPivot = new THREE.Group();
    pedPivot.position.set(pedGate.hingeX, pedGate.y, pedGate.z);
    const pedLeafGeo = new THREE.BoxGeometry(pedGate.width, pedGate.height, pedGate.thickness);
    const pedLeafMesh = new THREE.Mesh(pedLeafGeo, gateMat);
    pedLeafMesh.position.set(pedGate.width / 2, 0, 0);
    pedLeafMesh.castShadow = true;
    pedPivot.add(pedLeafMesh);
    group.add(pedPivot);

    const pedColBox = {
      id: 'gate_pedestrian_col',
      type: 'gate',
      minX: pedGate.x - pedGate.width / 2,
      maxX: pedGate.x + pedGate.width / 2,
      minZ: pedGate.z - 0.4,
      maxZ: pedGate.z + 0.4,
      minY: 0,
      maxY: pedGate.height,
      disabled: false
    };

    const pedGateEntry = {
      id: pedGate.id,
      name: pedGate.name,
      isOpen: false,
      position: new THREE.Vector3(pedGate.x, pedGate.y, pedGate.z),
      pivotMesh: pedPivot,
      targetAngle: 0,
      currentAngle: 0,
      collisionBox: pedColBox,
      onToggle: () => {
        pedGateEntry.isOpen = !pedGateEntry.isOpen;
        pedGateEntry.targetAngle = pedGateEntry.isOpen ? Math.PI / 2 : 0;
        pedColBox.disabled = pedGateEntry.isOpen;
        if (onInteractionChange) {
          onInteractionChange({
            name: pedGateEntry.name,
            isOpen: pedGateEntry.isOpen,
            onToggle: pedGateEntry.onToggle
          });
        }
      }
    };

    doorsRef.current = [vehGateEntry, pedGateEntry];

    // G. Procedural Architectural Landscaping Trees
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.85 });

    site.trees.forEach(t => {
      const treeGroup = new THREE.Group();
      treeGroup.position.set(t.x, 0, t.z);

      // Trunk
      const trunkGeo = new THREE.CylinderGeometry(t.trunkR * 0.7, t.trunkR, t.trunkH, 8);
      const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
      trunkMesh.position.y = t.trunkH / 2;
      trunkMesh.castShadow = true;
      treeGroup.add(trunkMesh);

      // Tiered Foliage Cones
      const coneCount = 3;
      for (let i = 0; i < coneCount; i++) {
        const coneR = t.crownR * (1 - i * 0.22);
        const coneH = (t.crownH / coneCount) * 1.35;
        const coneGeo = new THREE.ConeGeometry(coneR, coneH, 8);
        const coneMesh = new THREE.Mesh(coneGeo, foliageMat);
        coneMesh.position.y = t.trunkH + i * (coneH * 0.65);
        coneMesh.castShadow = true;
        treeGroup.add(coneMesh);
      }
      group.add(treeGroup);
    });

    // H. Perimeter Boxwood Hedges
    const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.9 });
    site.hedges.forEach(h => {
      const hGeo = new THREE.BoxGeometry(h.width, h.height, h.length);
      const hMesh = new THREE.Mesh(hGeo, hedgeMat);
      hMesh.position.set(h.x, h.y, h.z);
      hMesh.castShadow = true;
      group.add(hMesh);
    });

    // I. Entrance Steps and Plinth
    site.entranceSteps.steps.forEach(st => {
      const stGeo = new THREE.BoxGeometry(st.width, st.height, st.length);
      const stMesh = new THREE.Mesh(stGeo, paverMat);
      stMesh.position.set(site.entranceSteps.x, st.y, st.z);
      stMesh.castShadow = true;
      stMesh.receiveShadow = true;
      group.add(stMesh);
    });

    // J. Cantilevered Porch Canopy & Support Columns
    const canopyMat = new THREE.MeshStandardMaterial({
      color: concept.roofColor,
      roughness: 0.4,
      metalness: 0.8
    });
    const colMat = new THREE.MeshStandardMaterial({
      color: concept.metalTrim,
      roughness: 0.3,
      metalness: 0.9
    });

    const canopyGeo = new THREE.BoxGeometry(site.porchCanopy.width, site.porchCanopy.thickness, site.porchCanopy.length);
    const canopyMesh = new THREE.Mesh(canopyGeo, canopyMat);
    canopyMesh.position.set(site.porchCanopy.x, site.porchCanopy.y, site.porchCanopy.z);
    canopyMesh.castShadow = true;
    group.add(canopyMesh);

    // Canopy Left and Right Steel Columns
    [site.porchCanopy.columnL, site.porchCanopy.columnR].forEach(col => {
      const colGeo = new THREE.CylinderGeometry(col.radius, col.radius, col.height, 12);
      const colMesh = new THREE.Mesh(colGeo, colMat);
      colMesh.position.set(col.x, col.y, col.z);
      colMesh.castShadow = true;
      group.add(colMesh);
    });

    // K. Roof Terrace Parapet Railing
    site.terrace.parapetSegments.forEach(p => {
      const pGeo = new THREE.BoxGeometry(p.width, p.height, p.length);
      const pMat = new THREE.MeshStandardMaterial({
        color: concept.terraceRailColor,
        roughness: 0.5,
        metalness: 0.5,
        transparent: concept.id === 'contemporary_minimalist',
        opacity: concept.id === 'contemporary_minimalist' ? 0.65 : 1.0
      });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      pMesh.position.set(p.x, p.y, p.z);
      pMesh.castShadow = true;
      group.add(pMesh);
    });

    // L. Pathway Bollards
    site.exteriorLights.filter(l => l.type === 'bollard').forEach(b => {
      const bPostGeo = new THREE.CylinderGeometry(0.2, 0.2, b.y, 8);
      const bPostMesh = new THREE.Mesh(bPostGeo, colMat);
      bPostMesh.position.set(b.x, b.y / 2, b.z);
      group.add(bPostMesh);

      const bHeadGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.4, 8);
      const bHeadMat = new THREE.MeshStandardMaterial({ color: b.color, emissive: b.color, emissiveIntensity: 0.8 });
      const bHeadMesh = new THREE.Mesh(bHeadGeo, bHeadMat);
      bHeadMesh.position.set(b.x, b.y, b.z);
      group.add(bHeadMesh);

      if (extLightsGroup) {
        const bLight = new THREE.PointLight(b.color, b.intensity, 10, 2);
        bLight.position.set(b.x, b.y + 0.2, b.z);
        extLightsGroup.add(bLight);
      }
    });

    // Store site collision boxes
    collisionBoxesRef.current = [...site.collisionBoxes, vehColBox, pedColBox];
  }, [plotWidth, plotLength, rooms, facing, designConcept]);

  // 6. Dynamic Reveal Transforms (Decoupled from Scene Rebuild)
  useEffect(() => {
    if (!isRevealing && revealProgress === 1.0) {
      if (groundSlabMeshRef.current) groundSlabMeshRef.current.position.y = 0.22;
      if (level0WallsGroupRef.current) {
        level0WallsGroupRef.current.scale.y = 1.0;
        level0WallsGroupRef.current.position.y = 0;
      }
      if (level1GroupRef.current) {
        const gap = floorMode === 'exploded' ? explodedGap : 0;
        level1GroupRef.current.position.y = getFloorElevation(1, gap);
        level1GroupRef.current.visible = true;
      }
      return;
    }

    if (!isRevealing && revealProgress === 0) return;

    const reveal = calculateRevealState(revealProgress);

    if (groundSlabMeshRef.current) {
      groundSlabMeshRef.current.position.y = 0.22 + reveal.groundSlabY;
    }
    if (level0WallsGroupRef.current) {
      level0WallsGroupRef.current.scale.y = Math.max(0.001, reveal.l0WallScale);
    }
    if (level1GroupRef.current) {
      const gap = floorMode === 'exploded' ? explodedGap : 0;
      const targetBaseY = getFloorElevation(1, gap);
      level1GroupRef.current.position.y = targetBaseY + 12.0 * (1.0 - reveal.l1StructureProgress);
      level1GroupRef.current.visible = reveal.l1StructureProgress > 0.02;
    }
  }, [isRevealing, revealProgress, floorMode, explodedGap]);

  // 7. Rebuild Architectural 3D Building Model (Rooms, Walls, Doors, Stairs, Furniture)
  useEffect(() => {
    const group = buildingGroupRef.current;
    const interiorLightsGroup = interiorLightsGroupRef.current;
    if (!group) return;

    disposeGroup(group);

    // Clear interior lights
    if (interiorLightsGroup) {
      while (interiorLightsGroup.children.length > 0) {
        interiorLightsGroup.remove(interiorLightsGroup.children[0]);
      }
    }

    roomMeshesRef.current = [];
    furnitureMeshesRef.current = [];

    if (!rooms || rooms.length === 0) return;

    // Determine Wall Height & Cutaway
    const isCutawayMode = floorMode === 'cutaway' || wallHeightMode === 'cutaway';
    const isExteriorMode = floorMode === 'exterior';
    const wallHeight = isExteriorMode ? 9.2 : (isCutawayMode ? CUTAWAY_WALL_HEIGHT : DEFAULT_WALL_HEIGHT);

    // Material Style & Concept selection
    const matPreset = MATERIAL_STYLES[materialStyle] || MATERIAL_STYLES.modern_scandi;
    const lightingStyle = LIGHTING_PRESETS[lightingPreset] || LIGHTING_PRESETS.warm_daylight;
    const concept = getDesignConcept(designConcept);
    const q = QUALITY_PRESETS[qualityPreset] || QUALITY_PRESETS.balanced;

    // Filter visible levels based on floorMode and Walkthrough
    let visibleRooms = rooms;
    if (isWalkthrough && walkthroughWaypoint) {
      visibleRooms = rooms.filter(r => (r.level || 0) === (walkthroughWaypoint.level || 0));
    } else if (floorMode === 'ground') {
      visibleRooms = rooms.filter(r => (r.level || 0) === 0);
    } else if (floorMode === 'first') {
      visibleRooms = rooms.filter(r => (r.level || 0) === 1);
    }

    const activeLevels = Array.from(new Set(visibleRooms.map(r => r.level || 0))).sort((a, b) => a - b);

    // Building Materials
    const wallMat = new THREE.MeshStandardMaterial({
      color: concept.wallColor,
      roughness: concept.wallRoughness,
      metalness: 0.04
    });

    const wallEdgeMat = new THREE.LineBasicMaterial({
      color: 0x94a3b8,
      linewidth: 1
    });

    const doorFrameMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.6,
      metalness: 0.2
    });

    const doorLeafMat = new THREE.MeshStandardMaterial({
      color: concept.woodTrim,
      roughness: 0.65,
      metalness: 0.1
    });

    const windowFrameMat = new THREE.MeshStandardMaterial({
      color: concept.metalTrim,
      roughness: 0.5,
      metalness: 0.4
    });

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.42,
      roughness: 0.08,
      metalness: 0.1,
      transmission: 0.65,
      ior: 1.52
    });

    const stairTreadMat = new THREE.MeshStandardMaterial({
      color: 0xa16207,
      roughness: 0.4,
      metalness: 0.1
    });

    const stairRiserMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.6
    });

    const metalTrimMat = new THREE.MeshStandardMaterial({
      color: concept.metalTrim,
      roughness: 0.35,
      metalness: 0.8
    });

    // Build Each Level
    activeLevels.forEach((level) => {
      const levelGroup = new THREE.Group();
      group.add(levelGroup);

      if (level === 1) level1GroupRef.current = levelGroup;

      const levelRooms = visibleRooms.filter(r => (r.level || 0) === level);

      let baseY = getFloorElevation(level, floorMode === 'exploded' ? explodedGap : 0);
      if (floorMode === 'first') {
        baseY = 0;
      }

      // A. Floor Slab
      const slabGeo = new THREE.BoxGeometry(plotWidth, 0.45, plotLength);
      const slabMat = new THREE.MeshStandardMaterial({
        color: level === 0 ? ARCHITECTURAL_PALETTE.slabGround : ARCHITECTURAL_PALETTE.slabUpper,
        roughness: 0.75,
        metalness: 0.1
      });
      const slabMesh = new THREE.Mesh(slabGeo, slabMat);
      slabMesh.position.set(0, baseY + 0.22, 0);
      slabMesh.receiveShadow = true;
      levelGroup.add(slabMesh);

      if (level === 0) groundSlabMeshRef.current = slabMesh;

      const slabEdgesGeo = new THREE.EdgesGeometry(slabGeo);
      const slabEdges = new THREE.LineSegments(slabEdgesGeo, wallEdgeMat);
      slabEdges.position.copy(slabMesh.position);
      levelGroup.add(slabEdges);

      // B. Exploded View Corner Dashed Guide Lines
      if (floorMode === 'exploded' && level > 0 && !isRevealing) {
        const cornerOffsets = [
          [-plotWidth / 2, -plotLength / 2],
          [plotWidth / 2, -plotLength / 2],
          [plotWidth / 2, plotLength / 2],
          [-plotWidth / 2, plotLength / 2]
        ];

        cornerOffsets.forEach(([cx, cz]) => {
          const points = [
            new THREE.Vector3(cx, 0, cz),
            new THREE.Vector3(cx, baseY, cz)
          ];
          const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
          const lineMat = new THREE.LineDashedMaterial({
            color: 0x38bdf8,
            dashSize: 0.8,
            gapSize: 0.5,
            linewidth: 1
          });
          const line = new THREE.Line(lineGeo, lineMat);
          line.computeLineDistances();
          levelGroup.add(line);
        });
      }

      // Group for Level 0 walls & furniture to support smooth reveal scaling
      const wallsGroup = new THREE.Group();
      levelGroup.add(wallsGroup);
      if (level === 0) level0WallsGroupRef.current = wallsGroup;

      const furnitureGroup = new THREE.Group();
      levelGroup.add(furnitureGroup);
      if (level === 0) level0FurnitureGroupRef.current = furnitureGroup;

      // C. Build Rooms on this level
      levelRooms.forEach((room, roomIdx) => {
        const coords = convert2DTo3DCoords(room.x, room.y, room.width, room.length, plotWidth, plotLength);
        const isSelected = selectedRoomId === room.id;
        const rotDeg = room.rotation || 0;
        const rad = -(rotDeg * Math.PI / 180);
        const cosR = Math.cos(rad);
        const sinR = Math.sin(rad);
        const getRotatedWorld = (lx, lz) => ({
          x: coords.x + lx * cosR - lz * sinR,
          z: coords.z + lx * sinR + lz * cosR
        });
        const isRotated90or270 = (rotDeg === 90 || rotDeg === 270);

        // Room container group with Y-axis rotation sync
        const roomGroup = new THREE.Group();
        roomGroup.position.set(coords.x, 0, coords.z);
        roomGroup.rotation.y = rad;
        wallsGroup.add(roomGroup);

        // 1. Room Floor Tile Finish
        let floorColor = matPreset.livingFloor;
        if (room.type.includes('bed')) floorColor = matPreset.bedroomFloor;
        else if (room.type.includes('kitchen')) floorColor = matPreset.kitchenFloor;
        else if (room.type.includes('bath')) floorColor = matPreset.bathFloor;
        else if (room.type.includes('parking')) floorColor = 0x334155;
        else if (room.type.includes('balcony')) floorColor = 0x64748b;

        const roomFloorGeo = new THREE.PlaneGeometry(room.width - 0.2, room.length - 0.2);
        const roomFloorMat = new THREE.MeshStandardMaterial({
          color: isSelected ? 0x0284c7 : floorColor,
          roughness: 0.55,
          metalness: 0.05,
          side: THREE.DoubleSide
        });
        const roomFloorMesh = new THREE.Mesh(roomFloorGeo, roomFloorMat);
        roomFloorMesh.rotation.x = -Math.PI / 2;
        roomFloorMesh.position.set(0, baseY + 0.46, 0);
        roomFloorMesh.receiveShadow = true;
        roomFloorMesh.userData = { room, roomId: room.id };
        roomGroup.add(roomFloorMesh);
        roomMeshesRef.current.push(roomFloorMesh);

        // Warm Interior Ceiling Light
        const shouldLightInterior = (lightingStyle.interiorLights || isWalkthrough || isSimulator) && interiorLightsGroup;
        if (shouldLightInterior && interiorLightsGroup.children.length < q.maxPointLights) {
          const roomLight = new THREE.PointLight(0xfde047, isWalkthrough ? 1.1 : 0.85, 20, 2);
          roomLight.position.set(coords.x, baseY + 6.8, coords.z);
          interiorLightsGroup.add(roomLight);
        }

        // 2. Room Walls & Collision Boxes
        const wallSegments = generateRoomWallSegments(room, plotWidth, plotLength, wallHeight, WALL_THICKNESS);
        wallSegments.forEach(ws => {
          const wGeo = new THREE.BoxGeometry(ws.width, ws.height, ws.length);
          const wMesh = new THREE.Mesh(wGeo, wallMat);
          wMesh.position.set(ws.x - coords.x, baseY + 0.45 + ws.height / 2, ws.z - coords.z);
          wMesh.castShadow = true;
          wMesh.receiveShadow = true;
          roomGroup.add(wMesh);

          const edgeGeo = new THREE.EdgesGeometry(wGeo);
          const edgeLines = new THREE.LineSegments(edgeGeo, wallEdgeMat);
          edgeLines.position.copy(wMesh.position);
          roomGroup.add(edgeLines);

          // Add solid wall collision box for First-Person Physics (rotated in world space)
          const segWorld = getRotatedWorld(ws.x - coords.x, ws.z - coords.z);
          const segW = isRotated90or270 ? ws.length : ws.width;
          const segL = isRotated90or270 ? ws.width : ws.length;
          collisionBoxesRef.current.push({
            id: `wall_${room.id}_${ws.wall}`,
            type: 'wall',
            minX: segWorld.x - segW / 2,
            maxX: segWorld.x + segW / 2,
            minZ: segWorld.z - segL / 2,
            maxZ: segWorld.z + segL / 2,
            minY: baseY,
            maxY: baseY + ws.height
          });
        });

        // 3. Realistic Door and Window Openings
        const openings = generateOpeningPlacements(room, plotWidth, plotLength, baseY);
        openings.forEach((op, opIdx) => {
          if (op.type === 'door') {
            // Door Frame (Jambs + Header)
            const frameGeo = new THREE.BoxGeometry(
              op.rotation === 0 ? op.width + 0.3 : 0.55,
              Math.min(op.height, wallHeight),
              op.rotation === 0 ? 0.55 : op.width + 0.3
            );
            const frameMesh = new THREE.Mesh(frameGeo, doorFrameMat);
            frameMesh.position.set(op.x - coords.x, baseY + 0.45 + Math.min(op.height, wallHeight) / 2, op.z - coords.z);
            roomGroup.add(frameMesh);

            // Door Leaf with Hinge Pivot (For animated opening/closing in simulator)
            const doorPivot = new THREE.Group();
            const hingeOffset = op.width / 2;
            const hingeX = op.rotation === 0 ? op.x - hingeOffset : op.x;
            const hingeZ = op.rotation === 0 ? op.z : op.z - hingeOffset;
            doorPivot.position.set(hingeX - coords.x, baseY + 0.45, hingeZ - coords.z);

            const leafW = op.rotation === 0 ? op.width - 0.2 : 0.2;
            const leafL = op.rotation === 0 ? 0.2 : op.width - 0.2;
            const leafH = Math.min(op.height - 0.2, wallHeight - 0.2);

            const leafGeo = new THREE.BoxGeometry(leafW, leafH, leafL);
            const leafMesh = new THREE.Mesh(leafGeo, doorLeafMat);
            leafMesh.position.set(
              op.rotation === 0 ? hingeOffset : 0,
              leafH / 2,
              op.rotation === 0 ? 0 : hingeOffset
            );
            leafMesh.castShadow = true;
            doorPivot.add(leafMesh);

            // Handle
            const handleGeo = new THREE.BoxGeometry(0.35, 0.08, 0.15);
            const handleMesh = new THREE.Mesh(handleGeo, metalTrimMat);
            handleMesh.position.set(
              op.rotation === 0 ? op.width * 0.8 : 0,
              2.8,
              op.rotation === 0 ? 0 : op.width * 0.8
            );
            doorPivot.add(handleMesh);

            roomGroup.add(doorPivot);

            // Closed Door Collision Box & Interaction Point
            const doorWorld = getRotatedWorld(op.x - coords.x, op.z - coords.z);
            const doorColBox = {
              id: `door_${room.id}_${opIdx}`,
              type: 'door',
              minX: doorWorld.x - (op.rotation === 0 ? op.width / 2 : 0.4),
              maxX: doorWorld.x + (op.rotation === 0 ? op.width / 2 : 0.4),
              minZ: doorWorld.z - (op.rotation === 0 ? 0.4 : op.width / 2),
              maxZ: doorWorld.z + (op.rotation === 0 ? 0.4 : op.width / 2),
              minY: baseY,
              maxY: baseY + op.height,
              disabled: false
            };
            collisionBoxesRef.current.push(doorColBox);

            // Register Door with Interactive Doors Registry
            const roomDoorEntry = {
              id: `door_${room.id}_${opIdx}`,
              name: `${room.name} Door`,
              isOpen: false,
              position: new THREE.Vector3(doorWorld.x, baseY + 3.5, doorWorld.z),
              pivotMesh: doorPivot,
              targetAngle: 0,
              currentAngle: 0,
              collisionBox: doorColBox,
              onToggle: () => {
                roomDoorEntry.isOpen = !roomDoorEntry.isOpen;
                roomDoorEntry.targetAngle = roomDoorEntry.isOpen ? Math.PI / 2 : 0;
                doorColBox.disabled = roomDoorEntry.isOpen;
                if (onInteractionChange) {
                  onInteractionChange({
                    name: roomDoorEntry.name,
                    isOpen: roomDoorEntry.isOpen,
                    onToggle: roomDoorEntry.onToggle
                  });
                }
              }
            };
            doorsRef.current.push(roomDoorEntry);
          } else if (op.type === 'window') {
            const winH = Math.min(op.height, wallHeight * 0.65);
            const winY = baseY + 0.45 + Math.min(op.y - baseY, wallHeight * 0.68);

            const winFrameGeo = new THREE.BoxGeometry(
              op.rotation === 0 ? op.width + 0.2 : 0.4,
              winH,
              op.rotation === 0 ? 0.4 : op.width + 0.2
            );
            const winFrame = new THREE.Mesh(winFrameGeo, windowFrameMat);
            winFrame.position.set(op.x - coords.x, winY, op.z - coords.z);
            roomGroup.add(winFrame);

            const winGlassGeo = new THREE.BoxGeometry(
              op.rotation === 0 ? op.width - 0.2 : 0.1,
              winH - 0.2,
              op.rotation === 0 ? 0.1 : op.width - 0.2
            );
            const winGlass = new THREE.Mesh(winGlassGeo, glassMat);
            winGlass.position.set(op.x - coords.x, winY, op.z - coords.z);
            roomGroup.add(winGlass);

            const mullionGeo = new THREE.BoxGeometry(
              op.rotation === 0 ? 0.15 : 0.35,
              winH,
              op.rotation === 0 ? 0.35 : 0.15
            );
            const mullion = new THREE.Mesh(mullionGeo, windowFrameMat);
            mullion.position.set(op.x - coords.x, winY, op.z - coords.z);
            roomGroup.add(mullion);
          }
        });

        // 4. Procedural Furniture with Inspection Metadata
        if (showFurniture) {
          const furnitureItems = generateRoomFurniture(room, plotWidth, plotLength, baseY + 0.45);
          furnitureItems.forEach(item => {
            const fGeo = new THREE.BoxGeometry(item.w, item.h, item.l);
            const fMat = new THREE.MeshStandardMaterial({
              color: item.color,
              roughness: item.roughness ?? 0.65,
              metalness: item.metalness ?? 0.1,
              transparent: !!item.transparent,
              opacity: item.opacity ?? 1.0
            });
            const fMesh = new THREE.Mesh(fGeo, fMat);
            fMesh.position.set(item.x - coords.x, item.y, item.z - coords.z);
            fMesh.castShadow = true;
            fMesh.receiveShadow = true;

            // Rich Inspection Metadata for Phase 6 HUD Card
            fMesh.userData.furnitureData = {
              name: item.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
              dimensions: `${item.w.toFixed(1)} × ${item.l.toFixed(1)} × ${item.h.toFixed(1)} ft`,
              room: room.name,
              category: room.type,
              material: `${concept.name} Collection`,
              clearance: `Complies with 3.0 ft ${room.name} architectural passage clearance`
            };

            roomGroup.add(fMesh);
            furnitureMeshesRef.current.push(fMesh);

            // Add collision box for major large items (bed, sofa, car, kitchen counters)
            const isMajorObstacle = item.w >= 2.5 && item.l >= 2.5 && !item.name.includes('lamp') && !item.name.includes('cushion');
            if (isMajorObstacle) {
              const furnWorld = getRotatedWorld(item.x - coords.x, item.z - coords.z);
              const furnW = isRotated90or270 ? item.l : item.w;
              const furnL = isRotated90or270 ? item.w : item.l;
              collisionBoxesRef.current.push({
                id: `furn_${room.id}_${item.name}`,
                type: 'furniture',
                minX: furnWorld.x - furnW / 2,
                maxX: furnWorld.x + furnW / 2,
                minZ: furnWorld.z - furnL / 2,
                maxZ: furnWorld.z + furnL / 2,
                minY: baseY,
                maxY: baseY + item.h
              });
            }
          });
        }

        // 5. Architectural Staircase (Treads + Risers + Handrail)
        const isStairs = room.type === 'staircase' || room.type === 'foyer' || room.name.toLowerCase().includes('stairs');
        if (isStairs && level === 0) {
          const steps = generateStairSteps(room, plotWidth, plotLength, 12);
          steps.forEach(st => {
            const treadGeo = new THREE.BoxGeometry(st.width, st.height * 0.4, st.length);
            const treadMesh = new THREE.Mesh(treadGeo, stairTreadMat);
            treadMesh.position.set(st.x - coords.x, baseY + 0.45 + st.y + st.height * 0.3, st.z - coords.z);
            treadMesh.castShadow = true;
            roomGroup.add(treadMesh);

            const riserGeo = new THREE.BoxGeometry(st.width * 0.96, st.height * 0.6, st.length * 0.2);
            const riserMesh = new THREE.Mesh(riserGeo, stairRiserMat);
            riserMesh.position.set(st.x - coords.x, baseY + 0.45 + st.y - st.height * 0.2, (st.z - st.length * 0.4) - coords.z);
            roomGroup.add(riserMesh);
          });

          if (steps.length > 2) {
            const firstStep = steps[0];
            const lastStep = steps[steps.length - 1];
            const railPoints = [
              new THREE.Vector3(firstStep.x - coords.x + firstStep.width / 2, baseY + 0.45 + firstStep.y + 3.2, firstStep.z - coords.z),
              new THREE.Vector3(lastStep.x - coords.x + lastStep.width / 2, baseY + 0.45 + lastStep.y + 3.2, lastStep.z - coords.z)
            ];
            const railGeo = new THREE.TubeGeometry(
              new THREE.CatmullRomCurve3(railPoints),
              12,
              0.12,
              8,
              false
            );
            const railMesh = new THREE.Mesh(railGeo, metalTrimMat);
            roomGroup.add(railMesh);
          }
        }

        // 6. Floating Room Badge (Only displayed on active floor when not in walkthrough or simulator)
        if (showLabels && !isWalkthrough && !isSimulator) {
          const labelSpec = calculateLabelSpecs(room, plotWidth, plotLength, wallHeight, baseY, roomIdx);
          const labelSprite = createRoomTextSprite(
            room.name,
            `${room.width} × ${room.length} ft`,
            room.color || '#38bdf8',
            isSelected
          );
          labelSprite.position.set(labelSpec.x, labelSpec.y, labelSpec.z);
          labelSprite.scale.set(labelSpec.scaleX, labelSpec.scaleY, 1);
          levelGroup.add(labelSprite);
        }
      });
    });
  }, [
    rooms,
    plotWidth,
    plotLength,
    floorMode,
    explodedGap,
    wallHeightMode,
    showFurniture,
    showLabels,
    lightingPreset,
    materialStyle,
    qualityPreset,
    isWalkthrough,
    walkthroughWaypoint,
    selectedRoomId,
    facing,
    designConcept,
    isSimulator
  ]);

  // 8. Phase 6: First-Person Simulator State Transitions
  useEffect(() => {
    const container = mountRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!container || !camera || !controls) return;

    if (isSimulator) {
      // Disable orbit controls
      controls.enabled = false;

      // Initialize FirstPersonController if not already created
      if (!fpsControllerRef.current) {
        fpsControllerRef.current = new FirstPersonController(camera, container, {
          onInteractionChange: (door) => {
            if (onInteractionChange) {
              onInteractionChange(door ? { name: door.name, isOpen: door.isOpen, onToggle: door.onToggle } : null);
            }
          },
          onFurnitureInspect: (item) => {
            if (onFurnitureInspect) onFurnitureInspect(item);
          },
          onToggleLights: () => {
            if (onToggleLights) onToggleLights();
          },
          onFloorChange: (floor) => {
            if (onFloorChange) onFloorChange(floor);
          },
          onExitSimulator: () => {
            if (onExitSimulator) onExitSimulator();
          }
        });
      }

      // Attach event listeners when entering simulator
      fpsControllerRef.current.attach();

      // Teleport player outside front gate at spawn point
      const site = generatePropertySite(plotWidth, plotLength, rooms, facing, designConcept);
      fpsControllerRef.current.teleport(
        site.spawnPoint.x,
        site.spawnPoint.y,
        site.spawnPoint.z,
        site.spawnPoint.yaw,
        site.spawnPoint.pitch
      );

      // Set physics environment
      fpsControllerRef.current.setEnvironment({
        collisionBoxes: collisionBoxesRef.current,
        interactiveDoors: doorsRef.current,
        furnitureItems: furnitureMeshesRef.current,
        rooms,
        plotWidth,
        plotLength
      });
    } else {
      // Exiting simulator: restore OrbitControls, detach listeners, and reframe
      if (fpsControllerRef.current) {
        fpsControllerRef.current.releaseLock();
        fpsControllerRef.current.detach();
      }
      controls.enabled = true;
      frameCamera();
    }
  }, [isSimulator]);

  // Update virtual movement from touch controls
  useEffect(() => {
    if (fpsControllerRef.current && virtualMovement) {
      fpsControllerRef.current.setVirtualKeys(virtualMovement);
    }
  }, [virtualMovement]);

  // 9. Interactive Raycasting for Room Hover and Selection (when not in simulator)
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let hoveredMesh = null;

    const handlePointerMove = (e) => {
      if (isSimulatorRef.current) return;

      const rect = container.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (!cameraRef.current || roomMeshesRef.current.length === 0) return;

      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObjects(roomMeshesRef.current, false);

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object;
        container.style.cursor = 'pointer';
        if (hoveredMesh !== hitMesh) {
          hoveredMesh = hitMesh;
          if (onHoverRoom && hitMesh.userData?.room) {
            onHoverRoom(hitMesh.userData.room);
          }
        }
      } else {
        container.style.cursor = 'default';
        if (hoveredMesh !== null) {
          hoveredMesh = null;
          if (onHoverRoom) onHoverRoom(null);
        }
      }
    };

    const handleClick = (e) => {
      if (isSimulatorRef.current) {
        // In simulator: click requests pointer lock for game mouse look
        if (fpsControllerRef.current) {
          fpsControllerRef.current.requestLock();
        }
        return;
      }

      const rect = container.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (!cameraRef.current || roomMeshesRef.current.length === 0) return;

      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObjects(roomMeshesRef.current, false);

      if (intersects.length > 0 && onSelectRoom) {
        const room = intersects[0].object.userData?.room;
        if (room) onSelectRoom(room);
      }
    };

    container.addEventListener('mousemove', handlePointerMove);
    container.addEventListener('click', handleClick);

    return () => {
      container.removeEventListener('mousemove', handlePointerMove);
      container.removeEventListener('click', handleClick);
    };
  }, [onSelectRoom, onHoverRoom]);

  return (
    <div
      ref={mountRef}
      className="canvas-3d-viewport"
      style={{
        width: '100%',
        height: '100%',
        minHeight: '540px',
        position: 'relative',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
        backgroundColor: '#0a0d12'
      }}
    />
  );
}
