export default function VideoSection() {
  return (
    <section className='bg-[#FAFAF7] px-6 pb-24 md:px-12'>
      <div className='mx-auto max-w-[1400px]'>
        <div className='mx-auto mb-10 max-w-3xl text-center'>
          <p className='mb-5 text-[10px] uppercase tracking-[0.2em] text-[#9A8A5A]'>Resort Atmosphere</p>
          <h2 className='mb-6 font-serif text-4xl leading-tight text-[#1A1A1A] md:text-6xl'>The hillside, alive through the day.</h2>
          <p className='mx-auto max-w-2xl text-sm leading-relaxed text-[#4A4A4A] md:text-base'>From quiet mornings to rain, dusk, and evening light, Pueblo La Perla moves with the rhythm of Boracay.</p>
        </div>
        <div className='relative aspect-[16/9] w-full overflow-hidden bg-stone-900 md:aspect-[21/9]'>
          <video className='absolute inset-0 h-full w-full object-cover' autoPlay muted loop playsInline preload='metadata' poster='/images/plp-hillside-villas.jpeg'>
            <source src='/videos/plp-living-hillside-loop.mp4' type='video/mp4' />
          </video>
        </div>
      </div>
    </section>
  );
}
