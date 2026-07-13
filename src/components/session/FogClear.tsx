// Fog-clear moment (BUILD PROMPT Section 4.5 / 12). The session-end constellation
// fog animation — something hidden becoming visible. ~1.8s, then advance.
import { useEffect } from "react";
import { motion } from "framer-motion";
import { sfx } from "@/lib/client/sfx";

export function FogClear({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    sfx("fog");
    const id = setTimeout(onDone, 1800);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <div className="screen center" style={{ justifyContent: "center", position: "relative", overflow: "hidden" }}>
      {/* fog veils parting */}
      <motion.div
        initial={{ opacity: 0.9, scale: 1.1 }}
        animate={{ opacity: 0, scale: 1.4 }}
        transition={{ duration: 1.6, ease: "easeOut" }}
        style={{
          position: "absolute",
          inset: -40,
          background: "radial-gradient(circle at 50% 50%, rgba(188,212,255,0.28), transparent 60%)",
          filter: "blur(24px)",
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="center"
      >
        <p className="kicker">The fog moves</p>
        <h1 className="reso" style={{ fontSize: 26, marginTop: 8 }}>
          Something comes into focus.
        </h1>
      </motion.div>
    </div>
  );
}
