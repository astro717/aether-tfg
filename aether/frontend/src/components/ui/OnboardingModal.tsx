/**
 * OnboardingModal Component
 * THE MONOPOLY STANDARD - Premium onboarding carousel that sells VALUE, not features.
 * Auto-triggers on first visit, replayable from Settings.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import {
    Sparkles,
    Brain,
    Gauge,
    Rocket,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE CONFIGURATION (The Monopoly Standard Copywriting)
// ─────────────────────────────────────────────────────────────────────────────

interface OnboardingSlide {
    icon: LucideIcon;
    title: string;
    subtitle: string;
    gradient: string;
    iconGlow: string;
    accentColor: string;
}

const SLIDES: OnboardingSlide[] = [
    {
        // Slide 1: La Promesa (Value Proposition)
        icon: Sparkles,
        title: 'Welcome to Aether',
        subtitle:
            'Your new predictive command center. Say goodbye to chaos and take full control of your team.',
        gradient: 'from-violet-600 via-purple-500 to-fuchsia-500',
        iconGlow: 'shadow-violet-500/50',
        accentColor: 'violet',
    },
    {
        // Slide 2: La Evidencia (Authority & AI)
        icon: Brain,
        title: 'Predictive Intelligence',
        subtitle:
            'Our AI evaluates the work rhythm and health of each task to provide infallible delivery estimates.',
        gradient: 'from-cyan-500 via-blue-500 to-indigo-600',
        iconGlow: 'shadow-cyan-500/50',
        accentColor: 'cyan',
    },
    {
        // Slide 3: El Flujo (Core Feature)
        icon: Gauge,
        title: 'Uninterrupted Flow',
        subtitle:
            'Detect bottlenecks in real-time. Act before projects derail.',
        gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
        iconGlow: 'shadow-emerald-500/50',
        accentColor: 'emerald',
    },
    {
        // Slide 4: Cierre (Call to Action)
        icon: Rocket,
        title: 'All Set',
        subtitle: 'Your empire awaits.',
        gradient: 'from-amber-500 via-orange-500 to-rose-500',
        iconGlow: 'shadow-amber-500/50',
        accentColor: 'amber',
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// CONFETTI EXPLOSION (Premium celebration effect)
// ─────────────────────────────────────────────────────────────────────────────

interface ConfettiPiece {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    rotation: number;
    rotationSpeed: number;
    scale: number;
    color: string;
    shape: 'rect' | 'circle' | 'star';
    delay: number;
}

const CONFETTI_COLORS = [
    '#fbbf24', // amber-400
    '#f97316', // orange-500
    '#ef4444', // red-500
    '#ec4899', // pink-500
    '#a855f7', // purple-500
    '#3b82f6', // blue-500
    '#22d3ee', // cyan-400
    '#10b981', // emerald-500
    '#ffffff', // white
];

function generateConfettiPieces(
    originX: number,
    originY: number,
    count: number
): ConfettiPiece[] {
    const shapes: ConfettiPiece['shape'][] = ['rect', 'circle', 'star'];

    return Array.from({ length: count }, (_, i) => {
        // Burst angle - spread across 360 degrees with slight upward bias
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
        const velocity = 8 + Math.random() * 12; // Higher velocity for explosive feel

        return {
            id: i,
            x: originX,
            y: originY,
            vx: Math.cos(angle) * velocity,
            vy: Math.sin(angle) * velocity - 5, // Slight upward bias
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 720, // Fast spinning
            scale: 0.6 + Math.random() * 0.8,
            color: CONFETTI_COLORS[
                Math.floor(Math.random() * CONFETTI_COLORS.length)
            ],
            shape: shapes[Math.floor(Math.random() * shapes.length)],
            delay: Math.random() * 0.15, // Staggered burst
        };
    });
}

function ConfettiPieceComponent({ piece }: { piece: ConfettiPiece }) {
    const shapeStyles: Record<ConfettiPiece['shape'], React.CSSProperties> = {
        rect: {
            width: 10 * piece.scale,
            height: 6 * piece.scale,
            borderRadius: 2,
        },
        circle: {
            width: 8 * piece.scale,
            height: 8 * piece.scale,
            borderRadius: '50%',
        },
        star: {
            width: 0,
            height: 0,
            borderLeft: `${5 * piece.scale}px solid transparent`,
            borderRight: `${5 * piece.scale}px solid transparent`,
            borderBottom: `${10 * piece.scale}px solid ${piece.color}`,
            background: 'transparent',
        },
    };

    return (
        <motion.div
            initial={{
                x: piece.x,
                y: piece.y,
                rotate: piece.rotation,
                scale: 0,
                opacity: 1,
            }}
            animate={{
                x: piece.x + piece.vx * 40,
                y: piece.y + piece.vy * 40 + 200, // Gravity effect
                rotate: piece.rotation + piece.rotationSpeed,
                scale: [0, piece.scale, piece.scale, 0],
                opacity: [1, 1, 1, 0],
            }}
            transition={{
                duration: 1.8,
                delay: piece.delay,
                ease: [0.23, 1, 0.32, 1], // Custom easing for natural feel
            }}
            className="absolute pointer-events-none"
            style={{
                ...shapeStyles[piece.shape],
                backgroundColor:
                    piece.shape !== 'star' ? piece.color : undefined,
                boxShadow: `0 0 6px ${piece.color}80`,
            }}
        />
    );
}

interface ConfettiExplosionProps {
    originX: number;
    originY: number;
    isActive: boolean;
}

function ConfettiExplosion({
    originX,
    originY,
    isActive,
}: ConfettiExplosionProps) {
    const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

    useEffect(() => {
        if (isActive) {
            // Generate 80 pieces for a dramatic explosion
            const newPieces = generateConfettiPieces(originX, originY, 80);
            setPieces(newPieces);
        }
    }, [isActive, originX, originY]);

    if (!isActive || pieces.length === 0) return null;

    return (
        <div className="fixed inset-0 z-[200] pointer-events-none overflow-hidden">
            {pieces.map((piece) => (
                <ConfettiPieceComponent key={piece.id} piece={piece} />
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHOCKWAVE EFFECT (Radial pulse on button click)
// ─────────────────────────────────────────────────────────────────────────────

function ShockwaveEffect({
    isActive,
    originX,
    originY,
}: {
    isActive: boolean;
    originX: number;
    originY: number;
}) {
    if (!isActive) return null;

    return (
        <div className="fixed inset-0 z-[150] pointer-events-none">
            {/* Multiple expanding rings */}
            {[0, 0.1, 0.2].map((delay, i) => (
                <motion.div
                    key={i}
                    initial={{
                        x: originX - 20,
                        y: originY - 20,
                        width: 40,
                        height: 40,
                        opacity: 0.8,
                    }}
                    animate={{
                        width: 600,
                        height: 600,
                        x: originX - 300,
                        y: originY - 300,
                        opacity: 0,
                    }}
                    transition={{
                        duration: 0.8,
                        delay,
                        ease: 'easeOut',
                    }}
                    className="absolute rounded-full border-2 border-amber-400/60"
                    style={{
                        background: `radial-gradient(circle, transparent 60%, rgba(251, 191, 36, 0.1) 100%)`,
                    }}
                />
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATED BACKGROUND GRADIENT
// ─────────────────────────────────────────────────────────────────────────────

function AnimatedGradientBg({ gradient }: { gradient: string }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 1.2 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 overflow-hidden"
        >
            {/* Primary gradient orb */}
            <motion.div
                animate={{
                    scale: [1, 1.1, 1],
                    opacity: [0.4, 0.6, 0.4],
                }}
                transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                }}
                className={`absolute -top-1/2 -left-1/2 w-[150%] h-[150%] rounded-full bg-gradient-to-br ${gradient} blur-3xl`}
            />
            {/* Secondary orb for depth */}
            <motion.div
                animate={{
                    scale: [1.1, 1, 1.1],
                    opacity: [0.3, 0.5, 0.3],
                }}
                transition={{
                    duration: 5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: 0.5,
                }}
                className={`absolute -bottom-1/4 -right-1/4 w-[100%] h-[100%] rounded-full bg-gradient-to-tl ${gradient} blur-3xl opacity-30`}
            />
        </motion.div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface OnboardingModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [direction, setDirection] = useState(0);
    const [isExploding, setIsExploding] = useState(false);
    const [explosionOrigin, setExplosionOrigin] = useState({ x: 0, y: 0 });
    const ctaButtonRef = useRef<HTMLButtonElement>(null);
    const buttonControls = useAnimation();

    const isLastSlide = currentSlide === SLIDES.length - 1;
    const isFirstSlide = currentSlide === 0;
    const slide = SLIDES[currentSlide];
    const IconComponent = slide.icon;

    const handleStartLeading = useCallback(() => {
        if (!ctaButtonRef.current) {
            onClose();
            return;
        }

        // Get button position for explosion origin
        const rect = ctaButtonRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        setExplosionOrigin({ x: centerX, y: centerY });
        setIsExploding(true);

        // Animate the button
        buttonControls.start({
            scale: [1, 1.15, 1],
            transition: { duration: 0.3 },
        });

        // Close after celebration
        setTimeout(() => {
            onClose();
        }, 1200);
    }, [onClose, buttonControls]);

    const goNext = useCallback(() => {
        if (isLastSlide) {
            handleStartLeading();
            return;
        }
        setDirection(1);
        setCurrentSlide((prev) => prev + 1);
    }, [isLastSlide, handleStartLeading]);

    const goPrev = useCallback(() => {
        if (isFirstSlide) return;
        setDirection(-1);
        setCurrentSlide((prev) => prev - 1);
    }, [isFirstSlide]);

    const goToSlide = useCallback(
        (index: number) => {
            setDirection(index > currentSlide ? 1 : -1);
            setCurrentSlide(index);
        },
        [currentSlide]
    );

    const handleSkip = useCallback(() => {
        setCurrentSlide(0);
        setIsExploding(false);
        onClose();
    }, [onClose]);

    // Reset state when modal reopens
    useEffect(() => {
        if (isOpen) {
            setCurrentSlide(0);
            setDirection(0);
            setIsExploding(false);
        }
    }, [isOpen]);

    // Animation variants
    const contentVariants = {
        enter: (dir: number) => ({
            x: dir > 0 ? 80 : -80,
            opacity: 0,
            scale: 0.95,
        }),
        center: {
            x: 0,
            opacity: 1,
            scale: 1,
        },
        exit: (dir: number) => ({
            x: dir < 0 ? 80 : -80,
            opacity: 0,
            scale: 0.95,
        }),
    };

    const textStaggerChildren = {
        center: {
            transition: {
                staggerChildren: 0.1,
                delayChildren: 0.2,
            },
        },
    };

    const fadeInUp = {
        enter: { opacity: 0, y: 20 },
        center: { opacity: 1, y: 0 },
    };

    return (
        <>
            {/* Confetti Explosion - Renders outside modal for full-screen effect */}
            <ConfettiExplosion
                originX={explosionOrigin.x}
                originY={explosionOrigin.y}
                isActive={isExploding}
            />
            <ShockwaveEffect
                originX={explosionOrigin.x}
                originY={explosionOrigin.y}
                isActive={isExploding}
            />

            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        {/* Backdrop with blur */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.4 }}
                            onClick={handleSkip}
                            className="absolute inset-0 bg-black/70 backdrop-blur-md"
                        />

                        {/* Modal Container - Glassmorphism */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 30 }}
                            animate={{
                                opacity: isExploding ? 0 : 1,
                                scale: isExploding ? 1.05 : 1,
                                y: 0,
                            }}
                            exit={{ opacity: 0, scale: 0.9, y: 30 }}
                            transition={{
                                type: 'spring',
                                damping: 28,
                                stiffness: 350,
                            }}
                            className="relative w-full max-w-2xl bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
                        >
                            {/* Animated Background */}
                            <AnimatePresence mode="wait">
                                <AnimatedGradientBg
                                    key={currentSlide}
                                    gradient={slide.gradient}
                                />
                            </AnimatePresence>

                            {/* Skip Button - Always visible */}
                            <motion.button
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                onClick={handleSkip}
                                className="absolute top-4 right-4 z-20 px-3 py-1.5 rounded-full text-xs font-medium text-white/60 hover:text-white hover:bg-white/10 transition-all duration-200 backdrop-blur-sm border border-white/5"
                            >
                                Skip
                            </motion.button>

                            {/* Content Area */}
                            <div className="relative z-10 px-10 pt-20 pb-10 min-h-[520px] flex flex-col">
                                {/* Slide Content */}
                                <AnimatePresence mode="wait" custom={direction}>
                                    <motion.div
                                        key={currentSlide}
                                        custom={direction}
                                        variants={contentVariants}
                                        initial="enter"
                                        animate="center"
                                        exit="exit"
                                        transition={{
                                            type: 'spring',
                                            stiffness: 300,
                                            damping: 30,
                                        }}
                                        className="flex-1 flex flex-col items-center text-center"
                                    >
                                        {/* Icon with dramatic glow */}
                                        <motion.div
                                            variants={textStaggerChildren}
                                            className="relative mb-10"
                                        >
                                            {/* Outer glow ring */}
                                            <motion.div
                                                animate={{
                                                    scale: [1, 1.2, 1],
                                                    opacity: [0.3, 0.6, 0.3],
                                                }}
                                                transition={{
                                                    duration: 3,
                                                    repeat: Infinity,
                                                    ease: 'easeInOut',
                                                }}
                                                className={`absolute inset-0 rounded-full bg-gradient-to-br ${slide.gradient} blur-2xl scale-150`}
                                            />
                                            {/* Icon container */}
                                            <motion.div
                                                variants={fadeInUp}
                                                className={`relative p-7 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 shadow-2xl ${slide.iconGlow}`}
                                            >
                                                <IconComponent
                                                    size={64}
                                                    className="text-white drop-shadow-lg"
                                                    strokeWidth={1.5}
                                                />
                                            </motion.div>
                                        </motion.div>

                                        {/* Title - Large, Bold */}
                                        <motion.h2
                                            variants={fadeInUp}
                                            transition={{ delay: 0.1 }}
                                            className="text-4xl font-bold text-white mb-5 tracking-tight leading-tight"
                                        >
                                            {slide.title}
                                        </motion.h2>

                                        {/* Subtitle - Clear, Concise */}
                                        <motion.p
                                            variants={fadeInUp}
                                            transition={{ delay: 0.2 }}
                                            className="text-lg text-white/70 leading-relaxed max-w-sm font-light"
                                        >
                                            {slide.subtitle}
                                        </motion.p>
                                    </motion.div>
                                </AnimatePresence>

                                {/* Navigation */}
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.4 }}
                                    className="mt-auto pt-8 flex items-center justify-between"
                                >
                                    {/* Back Button */}
                                    <button
                                        onClick={goPrev}
                                        disabled={isFirstSlide}
                                        className={`
                                            flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                                            ${
                                                isFirstSlide
                                                    ? 'opacity-0 pointer-events-none'
                                                    : 'text-white/60 hover:text-white hover:bg-white/10'
                                            }
                                        `}
                                    >
                                        <ChevronLeft size={18} />
                                        Back
                                    </button>

                                    {/* Progress Dots */}
                                    <div className="flex items-center gap-2.5">
                                        {SLIDES.map((_, index) => (
                                            <button
                                                key={index}
                                                onClick={() => goToSlide(index)}
                                                className={`
                                                    h-2 rounded-full transition-all duration-300 ease-out
                                                    ${
                                                        index === currentSlide
                                                            ? 'w-8 bg-white'
                                                            : 'w-2 bg-white/30 hover:bg-white/50'
                                                    }
                                                `}
                                                aria-label={`Go to slide ${index + 1}`}
                                            />
                                        ))}
                                    </div>

                                    {/* Next / CTA Button */}
                                    <motion.button
                                        ref={isLastSlide ? ctaButtonRef : null}
                                        onClick={goNext}
                                        animate={buttonControls}
                                        whileHover={{ scale: 1.03 }}
                                        whileTap={{ scale: 0.98 }}
                                        disabled={isExploding}
                                        className={`
                                            flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-200 relative overflow-hidden
                                            ${
                                                isLastSlide
                                                    ? `bg-gradient-to-r ${slide.gradient} text-white shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50`
                                                    : 'bg-white/15 text-white backdrop-blur-sm border border-white/10 hover:bg-white/25'
                                            }
                                        `}
                                    >
                                        {/* Shimmer effect on CTA */}
                                        {isLastSlide && (
                                            <motion.div
                                                animate={{
                                                    x: ['-100%', '200%'],
                                                }}
                                                transition={{
                                                    duration: 2,
                                                    repeat: Infinity,
                                                    ease: 'linear',
                                                }}
                                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
                                            />
                                        )}
                                        {isLastSlide ? (
                                            <>
                                                <Rocket
                                                    size={18}
                                                    className="relative z-10"
                                                />
                                                <span className="relative z-10">
                                                    Start Leading
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                Next
                                                <ChevronRight size={18} />
                                            </>
                                        )}
                                    </motion.button>
                                </motion.div>
                            </div>

                            {/* Bottom gradient line */}
                            <div
                                className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${slide.gradient}`}
                            />
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCALSTORAGE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const ONBOARDING_SEEN_KEY = 'aether_has_seen_tutorial';

export function hasSeenOnboarding(): boolean {
    return localStorage.getItem(ONBOARDING_SEEN_KEY) === 'true';
}

export function markOnboardingAsSeen(): void {
    localStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
}

export function resetOnboarding(): void {
    localStorage.removeItem(ONBOARDING_SEEN_KEY);
}
