declare module "vanta/dist/vanta.fog.min" {
  type VantaEffect = { destroy: () => void; resize?: () => void };
  const FOG: (options: Record<string, unknown>) => VantaEffect;
  export default FOG;
}
