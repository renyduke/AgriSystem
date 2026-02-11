import React from "react";
import { motion } from "framer-motion";

const Loading = ({ fullScreen = true, text = "Loading..." }) => {
    const containerClasses = fullScreen
        ? "fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm"
        : "flex flex-col items-center justify-center p-8";

    return (
        <div className={containerClasses}>
            <motion.div
                className="relative flex items-center justify-center w-16 h-16 mb-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
            >
                <motion.span
                    className="block w-16 h-16 border-4 border-gray-200 rounded-full"
                />
                <motion.span
                    className="absolute top-0 left-0 block w-16 h-16 border-4 border-green-600 rounded-full border-t-transparent"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
                <motion.div
                    className="absolute inset-0 flex items-center justify-center"
                    initial={{ scale: 0.8, opacity: 0.5 }}
                    animate={{ scale: [0.8, 1.1, 0.8], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                    {/* Optional: Add a small leaf or logo center if desired, for now keeping it simple */}
                    <div className="w-2 h-2 bg-green-600 rounded-full" />
                </motion.div>
            </motion.div>
            <motion.p
                className="text-green-800 font-medium text-lg tracking-wide"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
                {text}
            </motion.p>
        </div>
    );
};

export default Loading;
