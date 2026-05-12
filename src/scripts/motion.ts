import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (!prefersReducedMotion) {
  gsap.registerPlugin(ScrollTrigger);

  gsap.fromTo(
    "[data-hero-reveal]",
    { autoAlpha: 0, y: 28 },
    {
      autoAlpha: 1,
      y: 0,
      duration: 0.9,
      ease: "power3.out",
      stagger: 0.08
    }
  );

  gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((element) => {
    gsap.fromTo(
      element,
      { autoAlpha: 0, y: 42 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.75,
        ease: "power3.out",
        scrollTrigger: {
          trigger: element,
          start: "top 86%"
        }
      }
    );
  });

  gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((element) => {
    gsap.to(element, {
      yPercent: -10,
      ease: "none",
      scrollTrigger: {
        trigger: element,
        start: "top bottom",
        end: "bottom top",
        scrub: true
      }
    });
  });

  gsap.utils.toArray<HTMLElement>("[data-case-row]").forEach((row) => {
    const image = row.querySelector<HTMLElement>("[data-case-image]");
    const arrow = row.querySelector<HTMLElement>(".project-row__arrow");

    row.addEventListener("mouseenter", () => {
      gsap.to(image, { scale: 1.06, duration: 0.6, ease: "power3.out" });
      gsap.to(arrow, { x: 6, y: -6, duration: 0.35, ease: "power3.out" });
    });

    row.addEventListener("mouseleave", () => {
      gsap.to(image, { scale: 1, duration: 0.6, ease: "power3.out" });
      gsap.to(arrow, { x: 0, y: 0, duration: 0.35, ease: "power3.out" });
    });
  });
}
