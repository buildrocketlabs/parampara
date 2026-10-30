// Motion's animation features (animate, variants, exit, hover, tap, focus, in view), loaded after
// first paint by <LazyMotion> in Providers, so they never count toward first load JS (DESIGN §10).
export { domAnimation as default } from "motion/react";
