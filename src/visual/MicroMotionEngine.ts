import { VisualStyleDNA } from "./VisualStyleDNA";

export interface MicroMotionEffect {
  type: "subtle_scale" | "parallax_drift" | "floating" | "depth_shift" | "slow_pan" | "justified_shake" | "none";
  scaleStart: number;
  scaleEnd: number;
  panXStart?: number;
  panXEnd?: number;
  panYStart?: number;
  panYEnd?: number;
  rotationDrift?: number;
  duration: number;
  reasonSk: string;
}

export class MicroMotionEngine {
  static computeMicroMotion(
    duration: number,
    isHighEmphasis: boolean,
    style: VisualStyleDNA
  ): MicroMotionEffect {
    if (style.microMotion === "static" || style.motionIntensity < 0.1) {
      return {
        type: "none",
        scaleStart: 1.0,
        scaleEnd: 1.0,
        duration,
        reasonSk: "Statický záber bez micro-motion podľa vizuálneho profilu.",
      };
    }

    if (isHighEmphasis && style.motionIntensity >= 0.7) {
      return {
        type: "justified_shake",
        scaleStart: 1.05,
        scaleEnd: 1.08,
        rotationDrift: 0.5,
        duration,
        reasonSk: "Jemný akcentový pohyb pri vysokej emócii / dôraze.",
      };
    }

    if (style.microMotion === "floating_parallax") {
      return {
        type: "floating",
        scaleStart: 1.02,
        scaleEnd: 1.05,
        panYStart: -2,
        panYEnd: 2,
        rotationDrift: 0.4,
        duration,
        reasonSk: "Jemný paralaxný plávajúci efekt pre hĺbku.",
      };
    }

    // Default subtle drift
    return {
      type: "subtle_scale",
      scaleStart: 1.0,
      scaleEnd: 1.03,
      duration,
      reasonSk: "Pomalý micro-zoom pre zachovanie dynamiky záberu.",
    };
  }
}
