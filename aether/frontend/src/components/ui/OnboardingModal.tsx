/**
 * OnboardingModal Component
 * Premium multi-slide onboarding tutorial with glassmorphism design.
 * Auto-triggers on first visit, replayable from Settings.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Rocket,
    Columns,
    Brain,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface OnboardingSlide {
    icon: LucideIcon;
    title: string;
    description: string;
    gradient: string;
    iconColor: string;
}

const SLIDES: OnboardingSlide[] = [
    {
        icon: Rocket,
        title: 'Welcome to Aether 🌌',
        description:
            'Your new command center for team management. Say goodbye to chaos and embrace predictive workflow.',
        gradient: 'from-violet-500/20 to-indigo-500/20',
        iconColor: 'text-violet-400',
    },
    {
        icon: Columns,
        title: 'The Methodology (Kanban & Flow) 📊',
        description:
            'Move tasks effortlessly. Aether analyzes your bottlenecks in real-time and alerts you before projects derail.',
        gradient: 'from-blue-500/20 to-cyan-500/20',
        iconColor: 'text-blue-400',
    },
    {
        icon: Brain,
        title: 'Predictive Intelligence & Health 🧠',
        description:
            "Our AI evaluates each task's health and your work rhythm (Pulse) to deliver FAANG-level precision estimates.",
        gradient: 'from-emerald-500/20 to-teal-500/20',
        iconColor: 'text-emerald-400',
    },
    {
        icon: CheckCircle2,
        title: 'All Set 🚀',
        description:
            "You're ready to lead. Explore the Manager Zone if you manage teams, or focus on your Personal Dashboard to dominate daily tasks.",
        gradient: 'from-amber-500/20 to-orange-500/20',
        iconColor: 'text-amber-400',
    },
];

interface OnboardingModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [direction, setDirection] = useState(0);

    const isLastSlide = currentSlide === SLIDES.length - 1;
    const isFirstSlide = currentSlide === 0;

    const goNext = useCallback(() => {
        if (isLastSlide) {
            onClose();
            return;
        }
        setDirection(1);
        setCurrentSlide((prev) => prev + 1);
    }, [isLastSlide, onClose]);

    const goPrev = useCallback(() => {
        if (isFirstSlide) return;
        setDirection(-1);
        setCurrentSlide((prev) => prev - 1);
    }, [isFirstSlide]);

    const goToSlide = useCallback((index: number) => {
        setDirection(index > currentSlide ? 1 : -1);
        setCurrentSlide(index);
    }, [currentSlide]);

    const handleClose = useCallback(() => {
        setCurrentSlide(0);
        onClose();
    }, [onClose]);

    const slide = SLIDES[currentSlide];
    const IconComponent = slide.icon;

    const slideVariants = {
        enter: (dir: number) => ({
            x: dir > 0 ? 300 : -300,
            opacity: 0,
        }),
        center: {
            x: 0,
            opacity: 1,
        },
        exit: (dir: number) => ({
            x: dir < 0 ? 300 : -300,
            opacity: 0,
        }),
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop with blur */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        onClick={handleClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Modal Container */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="relative w-full max-w-2xl bg-zinc-900/95 border border-zinc-700/50 rounded-3xl shadow-2xl overflow-hidden"
                    >
                        {/* Close Button */}
                        <button
                            onClick={handleClose}
                            className="absolute top-5 right-5 z-10 p-2 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
                            aria-label="Close tutorial"
                        >
                            <X size={20} />
                        </button>

                        {/* Content Area */}
                        <div className="px-8 pt-12 pb-8 min-h-[420px] flex flex-col">
                            {/* Slide Content with Animation */}
                            <AnimatePresence mode="wait" custom={direction}>
                                <motion.div
                                    key={currentSlide}
                                    custom={direction}
                                    variants={slideVariants}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    transition={{
                                        x: { type: 'spring', stiffness: 300, damping: 30 },
                                        opacity: { duration: 0.2 },
                                    }}
                                    className="flex-1 flex flex-col items-center text-center"
                                >
                                    {/* Icon with Gradient Halo */}
                                    <div className="relative mb-8">
                                        {/* Glow effect */}
                                        <div
                                            className={`absolute inset-0 rounded-full bg-gradient-to-br ${slide.gradient} blur-2xl scale-150 opacity-60`}
                                        />
                                        {/* Icon container */}
                                        <div
                                            className={`relative p-6 rounded-full bg-gradient-to-br ${slide.gradient} border border-white/10`}
                                        >
                                            <IconComponent
                                                size={56}
                                                className={`${slide.iconColor} drop-shadow-lg`}
                                                strokeWidth={1.5}
                                            />
                                        </div>
                                    </div>

                                    {/* Title */}
                                    <h2 className="text-2xl font-bold text-white mb-4 tracking-tight">
                                        {slide.title}
                                    </h2>

                                    {/* Description */}
                                    <p className="text-zinc-400 text-base leading-relaxed max-w-md">
                                        {slide.description}
                                    </p>
                                </motion.div>
                            </AnimatePresence>

                            {/* Navigation */}
                            <div className="mt-8 flex items-center justify-between">
                                {/* Back Button */}
                                <button
                                    onClick={goPrev}
                                    disabled={isFirstSlide}
                                    className={`
                                        flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                                        ${isFirstSlide
                                            ? 'opacity-0 pointer-events-none'
                                            : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                                        }
                                    `}
                                >
                                    <ChevronLeft size={18} />
                                    Back
                                </button>

                                {/* Progress Dots */}
                                <div className="flex items-center gap-2">
                                    {SLIDES.map((_, index) => (
                                        <button
                                            key={index}
                                            onClick={() => goToSlide(index)}
                                            className={`
                                                w-2 h-2 rounded-full transition-all duration-300
                                                ${index === currentSlide
                                                    ? 'w-6 bg-white'
                                                    : 'bg-zinc-600 hover:bg-zinc-500'
                                                }
                                            `}
                                            aria-label={`Go to slide ${index + 1}`}
                                        />
                                    ))}
                                </div>

                                {/* Next / Get Started Button */}
                                <button
                                    onClick={goNext}
                                    className={`
                                        flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
                                        ${isLastSlide
                                            ? 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-[1.02]'
                                            : 'bg-zinc-800 text-white hover:bg-zinc-700'
                                        }
                                    `}
                                >
                                    {isLastSlide ? "Let's Go" : 'Next'}
                                    {!isLastSlide && <ChevronRight size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Subtle gradient border effect at bottom */}
                        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-zinc-600/50 to-transparent" />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

// localStorage key for tracking tutorial completion
export const ONBOARDING_SEEN_KEY = 'aether_has_seen_tutorial';

// Helper to check if user has seen tutorial
export function hasSeenOnboarding(): boolean {
    return localStorage.getItem(ONBOARDING_SEEN_KEY) === 'true';
}

// Helper to mark tutorial as seen
export function markOnboardingAsSeen(): void {
    localStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
}

// Helper to reset tutorial (for replay from settings)
export function resetOnboarding(): void {
    localStorage.removeItem(ONBOARDING_SEEN_KEY);
}
