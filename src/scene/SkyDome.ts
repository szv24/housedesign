import * as THREE from "three";

/** Gradient sky with a soft sun disc; colors are driven by the time-of-day state. */
export class SkyDome {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;

  constructor(radius = 900) {
    this.material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        zenith: { value: new THREE.Color() },
        horizon: { value: new THREE.Color() },
        ground: { value: new THREE.Color() },
        sunDir: { value: new THREE.Vector3(0, 1, 0) },
        sunColor: { value: new THREE.Color() },
        sunStrength: { value: 1 }
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * p;
          gl_Position.z = gl_Position.w;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 zenith; uniform vec3 horizon; uniform vec3 ground;
        uniform vec3 sunDir; uniform vec3 sunColor; uniform float sunStrength;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = h > 0.0 ? mix(horizon, zenith, pow(clamp(h, 0.0, 1.0), 0.55)) : mix(horizon, ground, clamp(-h * 6.0, 0.0, 1.0));
          float s = max(dot(d, normalize(sunDir)), 0.0);
          col += sunColor * (pow(s, 900.0) * 6.0 + pow(s, 12.0) * 0.35) * sunStrength;
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), this.material);
    this.mesh.name = "sky";
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
  }

  set(zenith: THREE.Color, horizon: THREE.Color, ground: THREE.Color, sunDir: THREE.Vector3, sunColor: THREE.Color, sunStrength: number): void {
    const u = this.material.uniforms;
    u.zenith.value.copy(zenith);
    u.horizon.value.copy(horizon);
    u.ground.value.copy(ground);
    u.sunDir.value.copy(sunDir);
    u.sunColor.value.copy(sunColor);
    u.sunStrength.value = sunStrength;
  }
}
