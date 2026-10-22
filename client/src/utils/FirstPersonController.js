/**
 * ArchAI Phase 6 — First-Person Architectural Simulator Controller
 *
 * Implements a high-performance, game-like first-person camera and physics engine:
 * - Direct WASD / Arrow keys movement with sprint (Shift) and jump/step-up (Space)
 * - True mouse look with Pointer Lock API and seamless drag-look fallback
 * - Axis-decoupled collision detection with smooth wall-sliding (player never gets stuck)
 * - Automatic step-up allowance for plinths, curbs, and thresholds (up to 0.85 ft)
 * - Continuous staircase navigation with elevation climbing between Level 0 and Level 1
 * - Interactive door & gate opening/closing with animated swing and dynamic collision updates
 * - Room light toggle (F key) and furniture raycast inspection HUD
 * - Virtual touch controls support for touchscreens
 */

import * as THREE from 'three';
import { convert2DTo3DCoords, STORY_HEIGHT } from './threeMath.js';

export class FirstPersonController {
  constructor(camera, domElement, options = {}) {
    this.camera = camera;
    this.domElement = domElement;

    // Movement settings (architectural scale: 1 unit = 1 ft)
    this.walkSpeed = options.walkSpeed || 7.0; // 7 ft/sec
    this.sprintSpeed = options.sprintSpeed || 13.5; // 13.5 ft/sec
    this.eyeHeight = options.eyeHeight || 5.5; // 5.5 ft eye level
    this.playerRadius = 1.0; // 1 ft collision radius
    this.stepUpMax = 0.85; // 0.85 ft automatic step-up allowance

    // Camera orientation
    this.yaw = options.initialYaw ?? 0; // Default 0 faces -Z (into house)
    this.pitch = options.initialPitch ?? 0;
    this.lookSpeed = 0.0022;

    // Set rotation order to YXZ for standard first-person pitch/yaw
    if (this.camera) {
      this.camera.rotation.order = 'YXZ';
    }

    // Position & Velocity
    this.position = new THREE.Vector3(
      options.initialPos?.x ?? 0,
      options.initialPos?.y ?? this.eyeHeight,
      options.initialPos?.z ?? 35
    );
    this.velocity = new THREE.Vector3();
    this.targetElevation = this.eyeHeight;
    this.currentFloor = 0; // 0 = Ground, 1 = First floor

    // Input state
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
      jump: false
    };

    this.isLocked = false;
    this.isDragging = false;
    this.prevPointer = { x: 0, y: 0 };

    // Dynamic environmental data
    this.collisionBoxes = [];
    this.interactiveDoors = [];
    this.furnitureItems = [];
    this.stairRooms = [];
    this.plotWidth = 30;
    this.plotLength = 40;

    // Raycasting & Interaction
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 12.0;
    this.aimTarget = null;
    this.nearestDoor = null;
    this.inspectedFurniture = null;

    // Callbacks
    this.onInteractionChange = options.onInteractionChange || null;
    this.onFurnitureInspect = options.onFurnitureInspect || null;
    this.onToggleLights = options.onToggleLights || null;
    this.onFloorChange = options.onFloorChange || null;
    this.onExitSimulator = options.onExitSimulator || null;

    // Bind event handlers
    this.isAttached = false;
    this._onKeyDown = this.onKeyDown.bind(this);
    this._onKeyUp = this.onKeyUp.bind(this);
    this._onMouseMove = this.onMouseMove.bind(this);
    this._onMouseDown = this.onMouseDown.bind(this);
    this._onMouseUp = this.onMouseUp.bind(this);
    this._onPointerLockChange = this.onPointerLockChange.bind(this);
  }

  attach() {
    if (this.isAttached) return;
    this.isAttached = true;
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    this.domElement.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
  }

  detach() {
    if (!this.isAttached) return;
    this.isAttached = false;
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    this.domElement.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock();
    }
    // Reset all pressed keys
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false
    };
  }

  requestLock() {
    if (this.domElement.requestPointerLock) {
      this.domElement.requestPointerLock();
    }
  }

  releaseLock() {
    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock();
    }
  }

  onPointerLockChange() {
    this.isLocked = document.pointerLockElement === this.domElement;
  }

  onMouseDown(e) {
    if (e.button === 0) {
      this.isDragging = true;
      this.prevPointer = { x: e.clientX, y: e.clientY };
    }
  }

  onMouseUp(e) {
    if (e.button === 0) {
      this.isDragging = false;
    }
  }

  onMouseMove(e) {
    let dx = 0;
    let dy = 0;

    if (this.isLocked) {
      dx = e.movementX || 0;
      dy = e.movementY || 0;
    } else if (this.isDragging) {
      dx = e.clientX - this.prevPointer.x;
      dy = e.clientY - this.prevPointer.y;
      this.prevPointer = { x: e.clientX, y: e.clientY };
    } else {
      return;
    }

    this.yaw -= dx * this.lookSpeed;
    this.pitch -= dy * this.lookSpeed;

    // Clamp pitch to avoid gimbal flipping (-83 to +83 degrees)
    const maxPitch = 1.45;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
  }

  onKeyDown(e) {
    if (!this.isAttached) return;
    // CRITICAL: Never intercept keystrokes if the user is typing in an input, textarea, or contentEditable!
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
      return;
    }

    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.sprint = true;
        break;
      case 'Space':
        this.keys.jump = true;
        e.preventDefault();
        break;
      case 'KeyE':
        this.interactNearest();
        break;
      case 'KeyF':
        if (this.onToggleLights) this.onToggleLights();
        break;
      case 'Escape':
        if (this.onExitSimulator) this.onExitSimulator();
        break;
      default:
        break;
    }
  }

  onKeyUp(e) {
    if (!this.isAttached) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
      return;
    }

    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.sprint = false;
        break;
      case 'Space':
        this.keys.jump = false;
        break;
      default:
        break;
    }
  }

  // Update virtual keys from on-screen touch controls
  setVirtualKeys(virtualKeys = {}) {
    if (virtualKeys.forward !== undefined) this.keys.forward = !!virtualKeys.forward;
    if (virtualKeys.backward !== undefined) this.keys.backward = !!virtualKeys.backward;
    if (virtualKeys.left !== undefined) this.keys.left = !!virtualKeys.left;
    if (virtualKeys.right !== undefined) this.keys.right = !!virtualKeys.right;
    if (virtualKeys.sprint !== undefined) this.keys.sprint = !!virtualKeys.sprint;
    if (virtualKeys.jump !== undefined) this.keys.jump = !!virtualKeys.jump;
    if (virtualKeys.turnLeft) this.yaw += 0.05;
    if (virtualKeys.turnRight) this.yaw -= 0.05;
  }


  // Set scene environment data
  setEnvironment({
    collisionBoxes = [],
    interactiveDoors = [],
    furnitureItems = [],
    rooms = [],
    plotWidth = 30,
    plotLength = 40
  }) {
    this.collisionBoxes = collisionBoxes;
    this.interactiveDoors = interactiveDoors;
    this.furnitureItems = furnitureItems;
    this.plotWidth = plotWidth;
    this.plotLength = plotLength;

    // Identify staircase rooms
    this.stairRooms = rooms
      .filter(r => r.type === 'staircase' || r.type === 'foyer' || r.name?.toLowerCase().includes('stair'))
      .map(r => {
        const coords = convert2DTo3DCoords(r.x, r.y, r.width, r.length, plotWidth, plotLength);
        return {
          room: r,
          minX: coords.x - r.width / 2,
          maxX: coords.x + r.width / 2,
          minZ: coords.z - r.length / 2,
          maxZ: coords.z + r.length / 2,
          level: r.level || 0
        };
      });
  }

  // Spawn player at target position
  teleport(x, y, z, yaw = null, pitch = 0) {
    this.position.set(x, y, z);
    if (yaw !== null && yaw !== undefined) this.yaw = yaw;
    this.pitch = pitch;
    this.velocity.set(0, 0, 0);
    this.targetElevation = y;
    if (this.camera) {
      this.camera.position.copy(this.position);
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    }
  }

  // Teleport directly into a specific room at human eye-level
  teleportToRoom(room, plotWidth = 30, plotLength = 40) {
    if (!room) return;
    const coords = convert2DTo3DCoords(room.x, room.y, room.width, room.length, plotWidth, plotLength);
    const floorY = (room.level || 0) * STORY_HEIGHT;
    this.currentFloor = room.level || 0;
    this.teleport(coords.x, floorY + this.eyeHeight, coords.z, 0, 0);
    if (this.onFloorChange) this.onFloorChange(this.currentFloor);
  }

  // Check collision between a proposed sphere/AABB and active collision boxes
  checkCollision(targetX, targetY, targetZ) {
    const r = this.playerRadius;
    const pMinX = targetX - r;
    const pMaxX = targetX + r;
    const pMinZ = targetZ - r;
    const pMaxZ = targetZ + r;
    const pMinY = targetY - this.eyeHeight + this.stepUpMax;
    const pMaxY = targetY + 0.5;

    for (const box of this.collisionBoxes) {
      if (box.disabled) continue;

      // Check vertical overlap
      if (pMaxY <= box.minY || pMinY >= box.maxY) continue;

      // Check horizontal AABB overlap
      if (pMaxX > box.minX && pMinX < box.maxX && pMaxZ > box.minZ && pMinZ < box.maxZ) {
        return { collides: true, box };
      }
    }

    return { collides: false };
  }

  // Handle staircase vertical climbing
  updateStairsNavigation() {
    let onStairs = false;
    const px = this.position.x;
    const pz = this.position.z;

    for (const st of this.stairRooms) {
      if (px >= st.minX && px <= st.maxX && pz >= st.minZ && pz <= st.maxZ) {
        onStairs = true;
        // Ascend along Z axis (from South towards North or vice versa)
        const totalLen = st.maxZ - st.minZ;
        // Normalized progress t: 0 at entrance to stairs, 1 at landing
        // In our coordinate system, south is positive Z, north is negative Z
        const t = Math.max(0, Math.min(1.0, (st.maxZ - pz) / totalLen));
        const stairHeight = STORY_HEIGHT;
        this.targetElevation = this.eyeHeight + t * stairHeight;

        if (t > 0.88 && this.currentFloor !== 1) {
          this.currentFloor = 1;
          if (this.onFloorChange) this.onFloorChange(1);
        } else if (t < 0.12 && this.currentFloor !== 0) {
          this.currentFloor = 0;
          if (this.onFloorChange) this.onFloorChange(0);
        }
        break;
      }
    }

    if (!onStairs) {
      // Determine ground vs upper floor elevation
      const baseFloorY = this.currentFloor === 1 ? STORY_HEIGHT : 0;
      this.targetElevation = baseFloorY + this.eyeHeight;
    }

    // Smoothly lerp vertical elevation
    this.position.y += (this.targetElevation - this.position.y) * 0.15;
  }

  // Door and Gate Interaction
  interactNearest() {
    if (this.nearestDoor && this.nearestDoor.onToggle) {
      this.nearestDoor.onToggle();
    }
  }

  // Update loop called every frame (dt in seconds)
  update(dt = 0.016) {
    const cappedDt = Math.min(0.05, Math.max(0.001, dt));
    const speed = this.keys.sprint ? this.sprintSpeed : this.walkSpeed;

    // Movement direction in horizontal plane (XZ)
    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    let moveX = 0;
    let moveZ = 0;

    if (this.keys.forward) {
      moveX += forwardX;
      moveZ += forwardZ;
    }
    if (this.keys.backward) {
      moveX -= forwardX;
      moveZ -= forwardZ;
    }
    if (this.keys.left) {
      moveX -= rightX;
      moveZ -= rightZ;
    }
    if (this.keys.right) {
      moveX += rightX;
      moveZ += rightZ;
    }

    // Normalize movement vector to prevent faster diagonal strafing
    const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (len > 0.0001) {
      moveX = (moveX / len) * speed * cappedDt;
      moveZ = (moveZ / len) * speed * cappedDt;
    }

    // AXIS-SEPARATED COLLISION SOLVER WITH SMOOTH WALL SLIDING
    // 1. Test X movement
    if (moveX !== 0) {
      const nextX = this.position.x + moveX;
      const colX = this.checkCollision(nextX, this.position.y, this.position.z);
      if (!colX.collides) {
        this.position.x = nextX;
      }
    }

    // 2. Test Z movement
    if (moveZ !== 0) {
      const nextZ = this.position.z + moveZ;
      const colZ = this.checkCollision(this.position.x, this.position.y, nextZ);
      if (!colZ.collides) {
        this.position.z = nextZ;
      }
    }

    // Staircase vertical climbing and floor elevation
    this.updateStairsNavigation();

    // Sync Three.js camera position and rotation in YXZ order
    this.camera.position.copy(this.position);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

    // Update Proximity & Raycast for Doors and Furniture Inspection
    this.updateInteractions();
  }

  updateInteractions() {
    // 1. Nearest Door Detection (within 6 ft)
    let closestDoor = null;
    let minDist = 6.0;

    for (const door of this.interactiveDoors) {
      const dist = this.position.distanceTo(door.position);
      if (dist < minDist) {
        minDist = dist;
        closestDoor = door;
      }
    }

    if (this.nearestDoor !== closestDoor) {
      this.nearestDoor = closestDoor;
      if (this.onInteractionChange) {
        this.onInteractionChange(closestDoor);
      }
    }

    // 2. Furniture Raycast Inspection from Camera Center
    if (this.furnitureItems.length > 0) {
      this.raycaster.set(
        this.camera.position,
        new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion)
      );

      const intersects = this.raycaster.intersectObjects(this.furnitureItems, false);
      let activeFurniture = null;

      if (intersects.length > 0) {
        const hit = intersects[0];
        if (hit.distance < 10.0 && hit.object.userData?.furnitureData) {
          activeFurniture = hit.object.userData.furnitureData;
        }
      }

      if (this.inspectedFurniture !== activeFurniture) {
        this.inspectedFurniture = activeFurniture;
        if (this.onFurnitureInspect) {
          this.onFurnitureInspect(activeFurniture);
        }
      }
    }
  }
}
