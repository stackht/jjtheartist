// Watercolour on paper: a small stable-fluids simulation (WebGL2) whose dye is treated as
// pigment absorbing light, so colours mix subtractively like real paint. Based on the
// classic GPU fluid approach (advection, vorticity confinement, pressure projection).

export type Quality = "high" | "low"
/** Per-channel absorbance (−ln reflectance). Higher = darker in that channel. */
export type Pigment = readonly [number, number, number]

const hexToAbsorb = (hex: string): Pigment => {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(v / 255, 0.04))
  return [-Math.log(c[0]), -Math.log(c[1]), -Math.log(c[2])]
}

export const PIGMENTS = {
  madder: hexToAbsorb("#c8342b"),
  ultramarine: hexToAbsorb("#2d3bd1"),
  ochre: hexToAbsorb("#e0a526"),
  viridian: hexToAbsorb("#1f7a63"),
  rose: hexToAbsorb("#e58aa6"),
  ink: hexToAbsorb("#1b1c22"),
} as const
export type PigmentName = keyof typeof PIGMENTS

const VERT = `#version 300 es
precision highp float;
in vec2 aPos;
uniform vec2 texel;
out vec2 vUv; out vec2 vL; out vec2 vR; out vec2 vT; out vec2 vB;
void main() {
  vUv = aPos * 0.5 + 0.5;
  vL = vUv - vec2(texel.x, 0.0); vR = vUv + vec2(texel.x, 0.0);
  vT = vUv + vec2(0.0, texel.y); vB = vUv - vec2(0.0, texel.y);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

const HEAD = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;
out vec4 o;
`

const SPLAT = HEAD + `
uniform sampler2D uTarget; uniform float aspect; uniform vec3 color; uniform vec2 point; uniform float radius;
void main() {
  vec2 p = vUv - point; p.x *= aspect;
  vec3 s = exp(-dot(p, p) / radius) * color;
  o = vec4(texture(uTarget, vUv).xyz + s, 1.0);
}`

const ADVECT = HEAD + `
uniform sampler2D uVelocity; uniform sampler2D uSource; uniform vec2 simTexel; uniform float dt; uniform float dissipation;
void main() {
  vec2 coord = vUv - dt * texture(uVelocity, vUv).xy * simTexel;
  o = texture(uSource, coord) / (1.0 + dissipation * dt);
}`

const DIVERGENCE = HEAD + `
uniform sampler2D uVelocity;
void main() {
  float L = texture(uVelocity, vL).x; float R = texture(uVelocity, vR).x;
  float T = texture(uVelocity, vT).y; float B = texture(uVelocity, vB).y;
  vec2 C = texture(uVelocity, vUv).xy;
  if (vL.x < 0.0) L = -C.x; if (vR.x > 1.0) R = -C.x;
  if (vT.y > 1.0) T = -C.y; if (vB.y < 0.0) B = -C.y;
  o = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`

const CURL = HEAD + `
uniform sampler2D uVelocity;
void main() {
  float L = texture(uVelocity, vL).y; float R = texture(uVelocity, vR).y;
  float T = texture(uVelocity, vT).x; float B = texture(uVelocity, vB).x;
  o = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`

const VORTICITY = HEAD + `
uniform sampler2D uVelocity; uniform sampler2D uCurl; uniform float curl; uniform float dt;
void main() {
  float L = texture(uCurl, vL).x; float R = texture(uCurl, vR).x;
  float T = texture(uCurl, vT).x; float B = texture(uCurl, vB).x;
  float C = texture(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= curl * C; force.y *= -1.0;
  vec2 v = texture(uVelocity, vUv).xy + force * dt;
  o = vec4(clamp(v, -1000.0, 1000.0), 0.0, 1.0);
}`

const PRESSURE = HEAD + `
uniform sampler2D uPressure; uniform sampler2D uDivergence;
void main() {
  float L = texture(uPressure, vL).x; float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x; float B = texture(uPressure, vB).x;
  float d = texture(uDivergence, vUv).x;
  o = vec4((L + R + B + T - d) * 0.25, 0.0, 0.0, 1.0);
}`

const GRADIENT = HEAD + `
uniform sampler2D uPressure; uniform sampler2D uVelocity;
void main() {
  float L = texture(uPressure, vL).x; float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x; float B = texture(uPressure, vB).x;
  vec2 v = texture(uVelocity, vUv).xy - vec2(R - L, T - B);
  o = vec4(v, 0.0, 1.0);
}`

const SCALE = HEAD + `
uniform sampler2D uTexture; uniform float value;
void main() { o = value * texture(uTexture, vUv); }`

// Paper + pigment. Dye holds absorbance; light passing the paint is exp(-absorbance).
// Edges where the dye density changes quickly darken, the way watercolour dries.
// Paper + pigment. Dye holds absorbance; light passing the paint is exp(-absorbance).
// Paper tooth and fibre are baked once into a tiling texture (R = tooth, G = fibre) instead of
// being recomputed with noise for every pixel, every frame.
const DISPLAY = HEAD + `
uniform sampler2D uDye; uniform sampler2D uPaper; uniform vec2 dyeTexel; uniform vec3 paper; uniform float density; uniform vec2 res;
float amount(vec2 uv) { vec3 d = texture(uDye, uv).rgb; return d.r + d.g + d.b; }
void main() {
  vec2 grain = texture(uPaper, vUv * res / 256.0).rg;
  vec3 dye = max(texture(uDye, vUv).rgb, 0.0);
  // Granulation: pigment settles into the paper's tooth.
  dye *= 0.82 + 0.36 * grain.r;
  // Drying edge: darken where density changes fast.
  float gx = amount(vUv + vec2(dyeTexel.x, 0.0)) - amount(vUv - vec2(dyeTexel.x, 0.0));
  float gy = amount(vUv + vec2(0.0, dyeTexel.y)) - amount(vUv - vec2(0.0, dyeTexel.y));
  float edge = clamp(length(vec2(gx, gy)) * 0.9, 0.0, 0.5);
  vec3 col = paper * exp(-dye * density) * (1.0 - edge * 0.35);
  col *= 0.975 + 0.035 * grain.g;
  o = vec4(col, 1.0);
}`

type FBO = { tex: WebGLTexture; fbo: WebGLFramebuffer; w: number; h: number }
type DoubleFBO = { read: FBO; write: FBO; swap: () => void; w: number; h: number }

export type Fluid = {
  splat: (x: number, y: number, dx: number, dy: number, pigment: Pigment | null, amount: number, radius?: number) => void
  step: (dt: number) => void
  render: () => void
  resize: () => void
  destroy: () => void
}

/** Returns null when the device can't run the simulation (no WebGL2 or float render targets). */
export function createFluid(canvas: HTMLCanvasElement, quality: Quality): Fluid | null {
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, preserveDrawingBuffer: false, powerPreference: "high-performance" })
  if (!gl) return null
  if (!gl.getExtension("EXT_color_buffer_float") && !gl.getExtension("EXT_color_buffer_half_float")) return null
  gl.getExtension("OES_texture_float_linear")

  const SIM = quality === "high" ? 128 : 80
  const DYE = quality === "high" ? 768 : 448
  const ITER = quality === "high" ? 14 : 8
  const CURL_STRENGTH = 18
  const DPR = Math.min(window.devicePixelRatio || 1, quality === "high" ? 1.25 : 1)

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader")
    return s
  }
  const vs = compile(gl.VERTEX_SHADER, VERT)
  const program = (src: string) => {
    const p = gl.createProgram()!
    gl.attachShader(p, vs)
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, src))
    gl.bindAttribLocation(p, 0, "aPos")
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link")
    const u: Record<string, WebGLUniformLocation | null> = {}
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number
    for (let i = 0; i < n; i++) {
      const name = gl.getActiveUniform(p, i)!.name
      u[name] = gl.getUniformLocation(p, name)
    }
    return { p, u }
  }

  let progs: Record<string, ReturnType<typeof program>>
  try {
    progs = {
      splat: program(SPLAT),
      advect: program(ADVECT),
      divergence: program(DIVERGENCE),
      curl: program(CURL),
      vorticity: program(VORTICITY),
      pressure: program(PRESSURE),
      gradient: program(GRADIENT),
      scale: program(SCALE),
      display: program(DISPLAY),
    }
  } catch (err) {
    console.warn("WetPaper: shader setup failed, using the still paper.", err)
    return null
  }

  const quad = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, quad)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

  // Bake the paper once: a 256² tile of tooth (fine + coarse noise) and fibre (streaky noise).
  const paperTex = (() => {
    const N = 256
    const hash = (x: number, y: number) => {
      const v = Math.sin(((x % N) + N) % N * 127.1 + (((y % N) + N) % N) * 311.7) * 43758.5453
      return v - Math.floor(v)
    }
    const noise = (x: number, y: number, period: number) => {
      const xi = Math.floor(x)
      const yi = Math.floor(y)
      const fx = x - xi
      const fy = y - yi
      const ux = fx * fx * (3 - 2 * fx)
      const uy = fy * fy * (3 - 2 * fy)
      const h = (a: number, b: number) => hash(a % period, b % period)
      const a0 = h(xi, yi) + (h(xi + 1, yi) - h(xi, yi)) * ux
      const b0 = h(xi, yi + 1) + (h(xi + 1, yi + 1) - h(xi, yi + 1)) * ux
      return a0 + (b0 - a0) * uy
    }
    const data = new Uint8Array(N * N * 4)
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const tooth = noise(x * 0.35, y * 0.35, Math.round(N * 0.35)) * 0.6 + noise(x * 0.0625, y * 0.0625, 16) * 0.4
        const fibre = noise(x * 0.03125, y * 0.5, 8) * 0.5 + noise(x * 0.9, y * 0.9, Math.round(N * 0.9)) * 0.5
        const k = (y * N + x) * 4
        data[k] = tooth * 255
        data[k + 1] = fibre * 255
        data[k + 3] = 255
      }
    }
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
    return tex
  })()

  const texture = (w: number, h: number, internal: number, format: number) => {
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, gl.HALF_FLOAT, null)
    const fbo = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    gl.viewport(0, 0, w, h)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    return { tex, fbo, w, h } as FBO
  }
  const double = (w: number, h: number, internal: number, format: number): DoubleFBO => {
    let a = texture(w, h, internal, format)
    let b = texture(w, h, internal, format)
    return {
      w,
      h,
      get read() {
        return a
      },
      get write() {
        return b
      },
      swap() {
        ;[a, b] = [b, a]
      },
    }
  }

  const fit = (base: number) => {
    const aspect = canvas.width / Math.max(1, canvas.height)
    return aspect >= 1
      ? { w: Math.round(base * aspect), h: base }
      : { w: base, h: Math.round(base / aspect) }
  }

  let velocity: DoubleFBO, dye: DoubleFBO, pressure: DoubleFBO, divergence: FBO, curl: FBO
  const allocate = () => {
    const s = fit(SIM)
    const d = fit(DYE)
    velocity = double(s.w, s.h, gl.RG16F, gl.RG)
    dye = double(d.w, d.h, gl.RGBA16F, gl.RGBA)
    pressure = double(s.w, s.h, gl.R16F, gl.RED)
    divergence = texture(s.w, s.h, gl.R16F, gl.RED)
    curl = texture(s.w, s.h, gl.R16F, gl.RED)
  }

  const resize = () => {
    const w = Math.max(1, Math.round(canvas.clientWidth * DPR))
    const h = Math.max(1, Math.round(canvas.clientHeight * DPR))
    if (canvas.width === w && canvas.height === h && velocity) return
    canvas.width = w
    canvas.height = h
    allocate()
  }
  resize()

  const bindProgram = (name: string) => {
    gl.useProgram(progs[name].p)
    return progs[name].u
  }
  const bindTex = (unit: number, tex: WebGLTexture) => {
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    return unit
  }
  const blit = (target: FBO | null) => {
    if (target) {
      gl.viewport(0, 0, target.w, target.h)
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo)
    } else {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  const splat: Fluid["splat"] = (x, y, dx, dy, pigment, amount, radius = 0.0022) => {
    const aspect = canvas.width / canvas.height
    let u = bindProgram("splat")
    gl.uniform2f(u.texel, 1 / velocity.w, 1 / velocity.h)
    gl.uniform1i(u.uTarget, bindTex(0, velocity.read.tex))
    gl.uniform1f(u.aspect, aspect)
    gl.uniform2f(u.point, x, y)
    gl.uniform3f(u.color, dx, dy, 0)
    gl.uniform1f(u.radius, radius * (aspect > 1 ? aspect : 1))
    blit(velocity.write)
    velocity.swap()
    if (!pigment || amount <= 0) return
    u = bindProgram("splat")
    gl.uniform2f(u.texel, 1 / dye.w, 1 / dye.h)
    gl.uniform1i(u.uTarget, bindTex(0, dye.read.tex))
    gl.uniform1f(u.aspect, aspect)
    gl.uniform2f(u.point, x, y)
    gl.uniform3f(u.color, pigment[0] * amount, pigment[1] * amount, pigment[2] * amount)
    gl.uniform1f(u.radius, radius * (aspect > 1 ? aspect : 1))
    blit(dye.write)
    dye.swap()
  }

  const step = (dt: number) => {
    const simTexel = [1 / velocity.w, 1 / velocity.h] as const
    let u = bindProgram("curl")
    gl.uniform2f(u.texel, ...simTexel)
    gl.uniform1i(u.uVelocity, bindTex(0, velocity.read.tex))
    blit(curl)

    u = bindProgram("vorticity")
    gl.uniform2f(u.texel, ...simTexel)
    gl.uniform1i(u.uVelocity, bindTex(0, velocity.read.tex))
    gl.uniform1i(u.uCurl, bindTex(1, curl.tex))
    gl.uniform1f(u.curl, CURL_STRENGTH)
    gl.uniform1f(u.dt, dt)
    blit(velocity.write)
    velocity.swap()

    u = bindProgram("divergence")
    gl.uniform2f(u.texel, ...simTexel)
    gl.uniform1i(u.uVelocity, bindTex(0, velocity.read.tex))
    blit(divergence)

    u = bindProgram("scale")
    gl.uniform2f(u.texel, ...simTexel)
    gl.uniform1i(u.uTexture, bindTex(0, pressure.read.tex))
    gl.uniform1f(u.value, 0.8)
    blit(pressure.write)
    pressure.swap()

    u = bindProgram("pressure")
    gl.uniform2f(u.texel, ...simTexel)
    gl.uniform1i(u.uDivergence, bindTex(1, divergence.tex))
    for (let i = 0; i < ITER; i++) {
      gl.uniform1i(u.uPressure, bindTex(0, pressure.read.tex))
      blit(pressure.write)
      pressure.swap()
    }

    u = bindProgram("gradient")
    gl.uniform2f(u.texel, ...simTexel)
    gl.uniform1i(u.uPressure, bindTex(0, pressure.read.tex))
    gl.uniform1i(u.uVelocity, bindTex(1, velocity.read.tex))
    blit(velocity.write)
    velocity.swap()

    u = bindProgram("advect")
    gl.uniform2f(u.texel, ...simTexel)
    gl.uniform2f(u.simTexel, ...simTexel)
    gl.uniform1i(u.uVelocity, bindTex(0, velocity.read.tex))
    gl.uniform1i(u.uSource, bindTex(0, velocity.read.tex))
    gl.uniform1f(u.dt, dt)
    gl.uniform1f(u.dissipation, 0.9)
    blit(velocity.write)
    velocity.swap()

    u = bindProgram("advect")
    gl.uniform2f(u.texel, 1 / dye.w, 1 / dye.h)
    gl.uniform2f(u.simTexel, ...simTexel)
    gl.uniform1i(u.uVelocity, bindTex(0, velocity.read.tex))
    gl.uniform1i(u.uSource, bindTex(1, dye.read.tex))
    gl.uniform1f(u.dt, dt)
    // Paint lingers, then slowly dries away.
    gl.uniform1f(u.dissipation, 0.12)
    blit(dye.write)
    dye.swap()
  }

  const render = () => {
    const u = bindProgram("display")
    gl.uniform2f(u.texel, 1 / dye.w, 1 / dye.h)
    gl.uniform2f(u.dyeTexel, 1 / dye.w, 1 / dye.h)
    gl.uniform1i(u.uDye, bindTex(0, dye.read.tex))
    gl.uniform1i(u.uPaper, bindTex(1, paperTex))
    gl.uniform3f(u.paper, 0.957, 0.953, 0.937)
    gl.uniform1f(u.density, 1.0)
    gl.uniform2f(u.res, gl.drawingBufferWidth, gl.drawingBufferHeight)
    blit(null)
  }

  // Release GPU memory but keep the context: React may mount the canvas again (dev
  // strict mode, fast refresh), and a lost context can't be recreated on the same canvas.
  const destroy = () => {
    for (const d of [velocity, dye, pressure]) for (const f of [d.read, d.write]) {
      gl.deleteTexture(f.tex)
      gl.deleteFramebuffer(f.fbo)
    }
    for (const f of [divergence, curl]) {
      gl.deleteTexture(f.tex)
      gl.deleteFramebuffer(f.fbo)
    }
    Object.values(progs).forEach(({ p }) => gl.deleteProgram(p))
    gl.deleteBuffer(quad)
    gl.deleteTexture(paperTex)
  }

  return { splat, step, render, resize, destroy }
}
