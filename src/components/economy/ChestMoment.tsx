// Chest opening ceremony on home (BUILD PROMPT Section 5 / 12).
// A pending chest that has unlocked lands here as a full 2s ceremony (mandatory
// juice) with a chest-open sound. Renders nothing when no chest is ready.
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "@/lib/client/api";
import { sfx } from "@/lib/client/sfx";

type Stage = "checking" | "sealed" | "opening" | "reward" | "gone";

export function ChestMoment() {
  const [stage, setStage] = useState<Stage>("checking");
  const [chest, setChest] = useState<{ id: string; later_n: number } | null>(null);
  const [reward, setReward] = useState<number | null>(null);

  useEffect(() => {
    api<{ ready: { id: string; later_n: number } | null }>("/api/chest/pending")
      .then((r) => {
        if (r.ready) {
          setChest(r.ready);
          setStage("sealed");
        } else setStage("gone");
      })
      .catch(() => setStage("gone"));
  }, []);

  async function open() {
    if (!chest) return;
    setStage("opening");
    sfx("chest");
    const r = await api<{ later_n: number }>("/api/chest/open", { body: { id: chest.id } }).catch(() => null);
    // full 2s ceremony before revealing the reward
    setTimeout(() => {
      setReward(r?.later_n ?? chest.later_n);
      setStage("reward");
    }, 2000);
  }

  if (stage === "checking" || stage === "gone") return null;

  return (
    <AnimatePresence>
      <motion.div
        key="chest"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 40,
          background: "rgba(6,10,22,0.92)",
          display: "grid",
          placeItems: "center",
          textAlign: "center",
        }}
      >
        {stage === "sealed" && (
          <div>
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1, rotate: [0, -3, 3, 0] }}
              transition={{ repeat: Infinity, duration: 2.4 }}
              style={{ fontSize: 88 }}
            >
              🧰
            </motion.div>
            <p className="dim" style={{ margin: "12px 0 20px" }}>Your chest unlocked.</p>
            <button className="btn btn-gold" onClick={open}>Open it</button>
          </div>
        )}
        {stage === "opening" && (
          <motion.div
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1.15, 0.9, 1.3], filter: ["brightness(1)", "brightness(2)"] }}
            transition={{ duration: 2 }}
            style={{ fontSize: 100 }}
          >
            ✨
          </motion.div>
        )}
        {stage === "reward" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="num" style={{ fontSize: 56, color: "var(--gold)" }}>+{reward} ★</h1>
            <p className="dim" style={{ marginTop: 8 }}>Patience paid.</p>
            <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => setStage("gone")}>
              Nice
            </button>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
