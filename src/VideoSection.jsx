import { useEffect, useRef, useState } from 'react';

export default function VideoSection() {
  const ref = useRef(null);
  const videoRef = useRef(null);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [playing, setPlaying] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReduceMotion(media.matches);
    media.addEventListener('change', updatePreference);
    return () => media.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      videoRef.current?.pause();
      setPlaying(false);
    }
  }, [reduceMotion]);

  useEffect(() => {
    if (!ref.current || shouldLoadVideo || reduceMotion) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoadVideo(true);
          observer.disconnect();
        }
      },
      { rootMargin: '360px 0px' }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [shouldLoadVideo, reduceMotion]);

  const togglePlayback = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      void videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  };

  return (
    <section ref={ref} className='bg-[#FAFAF7] px-6 pb-24 md:px-12'>
      <div className='mx-auto max-w-[1400px]'>
        <div className='mx-auto mb-10 max-w-3xl text-center'>
          <p className='mb-5 text-[10px] uppercase tracking-[0.2em] text-[#9A8A5A]'>Resort Atmosphere</p>
          <h2 className='mb-6 font-serif text-4xl leading-tight text-[#1A1A1A] md:text-6xl'>The hillside, alive through the day.</h2>
          <p className='mx-auto max-w-2xl text-sm leading-relaxed text-[#4A4A4A] md:text-base'>From quiet mornings to rain, dusk, and evening light, Pueblo La Perla moves with the rhythm of Boracay.</p>
        </div>
        <div className='relative aspect-[16/9] w-full overflow-hidden bg-[#1a1a1a] md:aspect-[21/9]' style={{ backgroundImage: "url('/images/plp-hillside-villas.jpeg')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <img src='/images/plp-hillside-villas.jpeg' alt='Pueblo La Perla hillside villas in Boracay' className='absolute inset-0 h-full w-full object-cover' loading='eager' decoding='async' />
          {shouldLoadVideo && !reduceMotion && !videoFailed && <>
            <video ref={videoRef} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)} onError={() => { setVideoFailed(true); setPlaying(false); }} className='absolute inset-0 h-full w-full object-cover' autoPlay muted loop playsInline preload='none' poster='/images/plp-hillside-villas.jpeg' aria-label='Pueblo La Perla hillside atmosphere video'>
              <source src='/videos/plp-living-hillside-loop.mp4' type='video/mp4' />
            </video>
            <button type='button' onClick={togglePlayback} className='absolute bottom-4 right-4 z-10 min-h-11 border border-white/60 bg-black/65 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white' aria-label={playing ? 'Pause resort video' : 'Play resort video'}>{playing ? 'Pause video' : 'Play video'}</button>
          </>}
        </div>
      </div>
    </section>
  );
}
