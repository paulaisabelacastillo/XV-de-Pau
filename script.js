const EVENT_DATE = new Date("2026-07-11T19:00:00-05:00");
const SPOTIFY_TRACK_URI = "spotify:track:2lTm559tuIvatlT1u0JYG2";
const SPOTIFY_IFRAME_API_URL = "https://open.spotify.com/embed/iframe-api/v1";
const FORMSPREE_SONG_ENDPOINT = "https://formspree.io/f/xeewvdjb";
const RSVP_API_URL = "https://script.google.com/macros/s/AKfycbzaOGuHOvPeCo0znMNDloEaQaktXPF6QLGhKkrOeuEBxwKYCcyge_cXYztGL9JGuw7tXg/exec";
const STORAGE_KEYS = {
  whatsapp: "xv_pau_whatsapp_confirmed",
  rsvpName: "xv_pau_rsvp_name",
  songRequest: "xv_pau_song_request",
};

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

const musicButton = $("#musicToggle");
const spotifyEmbed = $("#spotifyEmbed");
let isMusicPlaying = false;
let spotifyIframeApiPromise = null;
let spotifyControllerPromise = null;
let spotifyController = null;

// Animacion de entrada para que el scroll se sienta cinematografico.
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.16, rootMargin: "0px 0px -40px 0px" },
);

$$(".reveal").forEach((element) => revealObserver.observe(element));

function updateMusicButton() {
  document.body.classList.toggle("music-on", isMusicPlaying);
  if (!musicButton) return;
  musicButton.setAttribute("aria-pressed", String(isMusicPlaying));
  musicButton.setAttribute("aria-label", isMusicPlaying ? "Pausar musica" : "Activar musica");
  $(".music-status", musicButton).textContent = isMusicPlaying ? "OFF" : "PLAY";
}

function loadSpotifyIframeApi() {
  if (spotifyIframeApiPromise) return spotifyIframeApiPromise;

  spotifyIframeApiPromise = new Promise((resolve, reject) => {
    if (window.SpotifyIframeApi) {
      resolve(window.SpotifyIframeApi);
      return;
    }

    window.onSpotifyIframeApiReady = (iframeApi) => {
      window.SpotifyIframeApi = iframeApi;
      resolve(iframeApi);
    };

    const existingScript = document.querySelector("[data-spotify-iframe-api]");
    if (existingScript) return;

    const script = document.createElement("script");
    script.src = SPOTIFY_IFRAME_API_URL;
    script.async = true;
    script.dataset.spotifyIframeApi = "true";
    script.onerror = () => reject(new Error("No se pudo cargar Spotify."));
    document.head.appendChild(script);
  });

  return spotifyIframeApiPromise;
}

async function getSpotifyController() {
  if (spotifyControllerPromise) return spotifyControllerPromise;

  spotifyControllerPromise = loadSpotifyIframeApi().then(
    (iframeApi) =>
      new Promise((resolve, reject) => {
        if (!spotifyEmbed) {
          reject(new Error("No encontré el contenedor oculto de Spotify."));
          return;
        }

        iframeApi.createController(
          spotifyEmbed,
          {
            height: 80,
            theme: "dark",
            uri: SPOTIFY_TRACK_URI,
            width: 300,
          },
          (controller) => {
            let didResolve = false;
            const resolveWhenReady = () => {
              if (didResolve) return;
              didResolve = true;
              resolve(controller);
            };

            spotifyController = controller;
            controller.addListener("ready", resolveWhenReady);
            controller.addListener("playback_started", () => {
              isMusicPlaying = true;
              updateMusicButton();
            });
            controller.addListener("playback_update", (event) => {
              if (typeof event?.data?.isPaused !== "boolean") return;
              isMusicPlaying = !event.data.isPaused;
              updateMusicButton();
            });

            window.setTimeout(resolveWhenReady, 900);
          },
        );
      }),
  );

  return spotifyControllerPromise;
}

function showMusicError() {
  if (!musicButton) return;
  $(".music-status", musicButton).textContent = "ERR";
  musicButton.setAttribute("aria-label", "Spotify no pudo reproducir la musica");
}

async function pauseMusic() {
  try {
    await spotifyController?.pause();
  } catch (error) {
    console.warn("No se pudo pausar Spotify.", error);
  }
  isMusicPlaying = false;
  updateMusicButton();
}

async function playMusic() {
  try {
    const controller = await getSpotifyController();
    if (typeof controller.resume === "function") {
      controller.resume();
    } else {
      controller.play();
    }
    isMusicPlaying = true;
    updateMusicButton();
  } catch (error) {
    console.error("Spotify bloqueó la reproducción oculta.", error);
    showMusicError();
  }
}

function toggleMusic() {
  if (isMusicPlaying) {
    pauseMusic();
    return;
  }

  playMusic();
}

musicButton?.addEventListener("click", toggleMusic);
updateMusicButton();

const introAudio = $("#introAudio");
const introCarousel = $("#introCarousel");
const introCarouselPhotos = $$(".intro-carousel-photo");
const introPlayButton = $("#introPlayButton");
const introVideoStatus = $("#introVideoStatus");
let activeIntroPhoto = 0;

function updateIntroAudioButton(isPlaying) {
  introPlayButton?.classList.toggle("is-playing", isPlaying);
  introCarousel?.classList.toggle("is-playing", isPlaying);
  introPlayButton?.setAttribute(
    "aria-label",
    isPlaying ? "Pausar audio" : "Reproducir audio",
  );
}

function showIntroPhoto(index) {
  if (!introCarouselPhotos.length) return;
  activeIntroPhoto = (index + introCarouselPhotos.length) % introCarouselPhotos.length;
  introCarouselPhotos.forEach((photo, photoIndex) => {
    photo.classList.toggle("is-active", photoIndex === activeIntroPhoto);
  });
  const activePhoto = introCarouselPhotos[activeIntroPhoto];
  const activePhotoSrc = activePhoto?.currentSrc || activePhoto?.getAttribute("src") || activePhoto?.src;
  if (activePhotoSrc) introCarousel?.style.setProperty("--intro-bg", `url("${activePhotoSrc}")`);
}

showIntroPhoto(activeIntroPhoto);
window.setInterval(() => showIntroPhoto(activeIntroPhoto + 1), 3600);

introPlayButton?.addEventListener("click", async () => {
  if (!introAudio) return;

  if (!introAudio.paused) {
    introAudio.pause();
    updateIntroAudioButton(false);
    return;
  }

  try {
    await pauseMusic();
    await introAudio.play();
    updateIntroAudioButton(true);
    if (introVideoStatus) introVideoStatus.textContent = "";
  } catch (error) {
    console.warn("No se pudo reproducir el audio especial.", error);
    if (introVideoStatus) introVideoStatus.textContent = "Audio no disponible";
    updateIntroAudioButton(false);
  }
});

introAudio?.addEventListener("play", () => updateIntroAudioButton(true));
introAudio?.addEventListener("pause", () => updateIntroAudioButton(false));
introAudio?.addEventListener("ended", () => updateIntroAudioButton(false));

function updateCountdown() {
  const countdown = $("#countdown");
  if (!countdown) return;

  const diff = EVENT_DATE.getTime() - Date.now();
  if (diff <= 0) {
    countdown.innerHTML = `<div class="time-box"><strong>00</strong><span>llegó la noche</span></div>`;
    return;
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  Object.entries({ days, hours, minutes, seconds }).forEach(([key, value]) => {
    const target = $(`[data-count="${key}"]`);
    if (target) target.textContent = String(value).padStart(2, "0");
  });
}

updateCountdown();
window.setInterval(updateCountdown, 1000);

$$("img").forEach((image) => {
  image.addEventListener("error", () => {
    image.style.visibility = "hidden";
  }, { once: true });
});

const rsvpLookupForm = $("#rsvpLookupForm");
const rsvpLookupButton = $("#rsvpLookupButton");
const rsvpTitle = $("#rsvpTitle");
const guestNameInput = $("#guestName");
const rsvpResult = $("#rsvpResult");
const rsvpStatus = $("#rsvpStatus");
const guestNamesTarget = $("#guestNames");
const guestSeatsTarget = $("#guestSeats");
const sheetConfirmButton = $("#sheetConfirmButton");
let currentInvite = null;

if (guestNameInput) {
  guestNameInput.value = localStorage.getItem(STORAGE_KEYS.rsvpName) || "";
}

function setRsvpStatus(message, type = "info") {
  if (!rsvpStatus) return;
  rsvpStatus.textContent = message;
  rsvpStatus.dataset.type = type;
}

function requestRsvpApi(params) {
  return new Promise((resolve, reject) => {
    const callbackName = `xvPauRsvp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const url = new URL(RSVP_API_URL);
    const script = document.createElement("script");
    let timeoutId;

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) url.searchParams.set(key, value);
    });
    url.searchParams.set("callback", callbackName);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      delete window[callbackName];
      script.remove();
    };

    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("No pude conectar con la lista de invitados."));
    };

    timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("La lista de invitados tardó demasiado en responder."));
    }, 12000);

    script.src = url.toString();
    document.body.appendChild(script);
  });
}

function normalizeGuestSearch(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function showSelectedGuest(guest) {
  currentInvite = guest;
  if (guestNameInput) {
    guestNameInput.value = guest.nombre;
    localStorage.setItem(STORAGE_KEYS.rsvpName, guest.nombre);
  }
  if (guestNamesTarget) guestNamesTarget.textContent = guest.nombre;
  if (guestSeatsTarget) guestSeatsTarget.textContent = String(guest.cupos);
  if (rsvpResult) rsvpResult.hidden = false;
  if (rsvpLookupForm) rsvpLookupForm.hidden = true;
  if (rsvpTitle) rsvpTitle.hidden = true;

  const isConfirmed = String(guest.confirmado || "").toUpperCase() === "SI";
  setRsvpStatus(isConfirmed ? "Esta invitación ya aparece confirmada." : "");
}

function findAcceptedGuest(guests, query) {
  const normalizedQuery = normalizeGuestSearch(query);
  const exactGuest = guests.find((guest) => normalizeGuestSearch(guest.nombre) === normalizedQuery);
  if (exactGuest) return exactGuest;
  if (guests.length === 1) return guests[0];

  const closeGuests = guests.filter((guest) => {
    const normalizedName = normalizeGuestSearch(guest.nombre);
    return normalizedName.startsWith(normalizedQuery) || normalizedQuery.startsWith(normalizedName);
  });

  return closeGuests.length === 1 ? closeGuests[0] : null;
}

async function searchGuestsByName(query) {
  const q = query.trim();
  if (q.length < 3) {
    return [];
  }

  if (rsvpResult) rsvpResult.hidden = true;

  try {
    const data = await requestRsvpApi({ q });
    if (!data?.ok) throw new Error(data?.message || "No pude leer la lista de invitados.");

    return Array.isArray(data.guests) ? data.guests : [];
  } catch (error) {
    console.error(error);
    setRsvpStatus(error.message, "error");
    return [];
  }
}

function handleGuestNameTyping() {
  const value = guestNameInput.value;
  currentInvite = null;
  localStorage.setItem(STORAGE_KEYS.rsvpName, value);
  if (rsvpResult) rsvpResult.hidden = true;
  if (rsvpLookupForm) rsvpLookupForm.hidden = false;
  if (rsvpTitle) rsvpTitle.hidden = false;
  setRsvpStatus("");
}

guestNameInput?.addEventListener("input", handleGuestNameTyping);
guestNameInput?.addEventListener("compositionend", handleGuestNameTyping);

rsvpLookupForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = guestNameInput?.value || "";
  const originalText = rsvpLookupButton?.textContent;

  if (query.trim().length < 3) {
    setRsvpStatus("Escribe tu nombre completo.", "error");
    return;
  }

  setRsvpStatus("");
  if (rsvpLookupButton) {
    rsvpLookupButton.disabled = true;
    rsvpLookupButton.textContent = "Verificando...";
  }

  const guests = await searchGuestsByName(query);
  const acceptedGuest = findAcceptedGuest(guests, query);

  if (acceptedGuest) {
    showSelectedGuest(acceptedGuest);
  } else {
    currentInvite = null;
    setRsvpStatus("No encontré ese nombre en la lista.", "error");
  }

  if (rsvpLookupButton) {
    rsvpLookupButton.disabled = false;
    rsvpLookupButton.textContent = originalText;
  }
});

sheetConfirmButton?.addEventListener("click", async () => {
  if (!currentInvite) {
    setRsvpStatus("Primero selecciona tu nombre.", "error");
    return;
  }

  if (String(currentInvite.confirmado || "").toUpperCase() === "SI") {
    setRsvpStatus("Esta invitación ya aparece confirmada.");
    return;
  }

  const originalText = sheetConfirmButton.textContent;
  setRsvpStatus("Confirmando asistencia...");
  sheetConfirmButton.disabled = true;
  sheetConfirmButton.textContent = "Confirmando...";

  try {
    const data = await requestRsvpApi({ action: "confirm", id: currentInvite.id });
    if (!data?.ok) throw new Error(data?.message || "No pude guardar la confirmación.");

    currentInvite = {
      ...currentInvite,
      confirmado: data.confirmado || "SI",
      fechaConfirmacion: data.fechaConfirmacion,
    };
    localStorage.setItem(STORAGE_KEYS.whatsapp, new Date().toISOString());
    setRsvpStatus("Asistencia confirmada.");
    createSparkBurst(window.innerWidth / 2, window.innerHeight * 0.45, 18);
  } catch (error) {
    console.error(error);
    setRsvpStatus(error.message, "error");
  } finally {
    sheetConfirmButton.disabled = false;
    sheetConfirmButton.textContent = originalText;
  }
});

const songRequest = $("#songRequest");
const songRequestForm = $("#songRequestForm");
const songStatus = $("#songStatus");
if (songRequest) {
  songRequest.value = localStorage.getItem(STORAGE_KEYS.songRequest) || "";
  songRequest.addEventListener("input", () => {
    localStorage.setItem(STORAGE_KEYS.songRequest, songRequest.value);
  });
}

songRequestForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const recommendation = (songRequest?.value || "").trim();
  localStorage.setItem(STORAGE_KEYS.songRequest, recommendation);

  if (!recommendation) {
    if (songStatus) songStatus.textContent = "Escribe una canción para enviarla.";
    return;
  }

  const submitButton = $(".song-submit", songRequestForm);
  const originalButtonText = submitButton?.textContent || "";

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Enviando...";
  }
  if (songStatus) songStatus.textContent = "";

  try {
    const formData = new FormData(songRequestForm);
    formData.set("cancion", recommendation);
    formData.set("message", recommendation);
    formData.set("origen", "XV de Pau");
    formData.set("fecha", new Date().toISOString());

    const response = await fetch(FORMSPREE_SONG_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
      body: formData,
    });

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
      const formspreeMessage = responseData?.errors?.[0]?.message || responseData?.error;
      throw new Error(formspreeMessage || "Formspree no aceptó la recomendación.");
    }

    if (songStatus) songStatus.textContent = "Recomendación enviada";
    if (songRequest) songRequest.value = "";
    localStorage.removeItem(STORAGE_KEYS.songRequest);
    const rect = songRequestForm.getBoundingClientRect();
    createSparkBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, 18);
  } catch (error) {
    console.error(error);
    if (songStatus) songStatus.textContent = "No se pudo enviar. Intenta de nuevo.";
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
  }
});

const giftEffects = {
  envelopes: () => createEnvelopeRain(24),
  planes: () => createPlaneRain(24),
  money: () => createMoneyRain(26),
  confetti: () => createConfettiRain(54),
};

$$("[data-gift-effect]").forEach((button) => {
  button.addEventListener("click", () => {
    giftEffects[button.dataset.giftEffect]?.();
    createSparkBurst(window.innerWidth / 2, window.innerHeight * 0.45, 18);
  });
});

// Particulas doradas que reaccionan al tacto.
const canvas = $("#particleCanvas");
const ctx = canvas?.getContext("2d");
let particles = [];
let pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2, active: false };

function resizeCanvas() {
  if (!canvas || !ctx) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * ratio);
  canvas.height = Math.floor(window.innerHeight * ratio);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  seedParticles();
}

function seedParticles() {
  const total = window.innerWidth < 720 ? 46 : 82;
  particles = Array.from({ length: total }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    radius: Math.random() * 2.3 + 0.7,
    speedX: (Math.random() - 0.5) * 0.3,
    speedY: Math.random() * -0.34 - 0.08,
    alpha: Math.random() * 0.5 + 0.22,
  }));
}

function drawParticles() {
  if (!ctx) return;
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  particles.forEach((particle) => {
    const dx = particle.x - pointer.x;
    const dy = particle.y - pointer.y;
    const distance = Math.hypot(dx, dy);
    if (pointer.active && distance < 130) {
      particle.x += dx / distance || 0;
      particle.y += dy / distance || 0;
    }

    particle.x += particle.speedX;
    particle.y += particle.speedY;

    if (particle.y < -10) particle.y = window.innerHeight + 10;
    if (particle.x < -10) particle.x = window.innerWidth + 10;
    if (particle.x > window.innerWidth + 10) particle.x = -10;

    ctx.beginPath();
    ctx.fillStyle = `rgba(255, 217, 119, ${particle.alpha})`;
    ctx.shadowColor = "rgba(255, 217, 119, 0.72)";
    ctx.shadowBlur = 12;
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fill();
  });
  window.requestAnimationFrame(drawParticles);
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("pointermove", (event) => {
  pointer = { x: event.clientX, y: event.clientY, active: true };
});
window.addEventListener("pointerleave", () => {
  pointer.active = false;
});

resizeCanvas();
drawParticles();

function createSparkBurst(x, y, amount = 8) {
  return { x, y, amount };
}

function createEnvelopeRain(amount = 16) {
  for (let i = 0; i < amount; i += 1) {
    const envelope = document.createElement("span");
    envelope.className = "envelope-rain";
    envelope.style.left = `${Math.random() * 100}vw`;
    envelope.style.top = `${-8 - Math.random() * 18}vh`;
    envelope.style.setProperty("--drift", `${(Math.random() - 0.5) * 160}px`);
    envelope.style.setProperty("--angle", `${(Math.random() - 0.5) * 80}deg`);
    envelope.style.animationDelay = `${Math.random() * 420}ms`;
    document.body.appendChild(envelope);
    envelope.addEventListener("animationend", () => envelope.remove(), { once: true });
  }
}

function createPlaneRain(amount = 16) {
  const travelIcons = ["✈", "🧳", "🌎"];
  for (let i = 0; i < amount; i += 1) {
    const plane = document.createElement("span");
    plane.className = "plane-rain";
    plane.textContent = travelIcons[Math.floor(Math.random() * travelIcons.length)];
    plane.style.left = `${Math.random() * 100}vw`;
    plane.style.top = `${-8 - Math.random() * 18}vh`;
    plane.style.setProperty("--drift", `${(Math.random() - 0.5) * 220}px`);
    plane.style.setProperty("--angle", `${-25 + Math.random() * 50}deg`);
    plane.style.animationDelay = `${Math.random() * 440}ms`;
    document.body.appendChild(plane);
    plane.addEventListener("animationend", () => plane.remove(), { once: true });
  }
}

function createMoneyRain(amount = 16) {
  for (let i = 0; i < amount; i += 1) {
    const bill = document.createElement("span");
    bill.className = "money-rain";
    bill.style.left = `${Math.random() * 100}vw`;
    bill.style.top = `${-8 - Math.random() * 18}vh`;
    bill.style.setProperty("--drift", `${(Math.random() - 0.5) * 180}px`);
    bill.style.setProperty("--angle", `${(Math.random() - 0.5) * 70}deg`);
    bill.style.animationDelay = `${Math.random() * 420}ms`;
    document.body.appendChild(bill);
    bill.addEventListener("animationend", () => bill.remove(), { once: true });
  }
}

function createConfettiRain(amount = 32) {
  const colors = ["#8d1020", "#c89433", "#e8c46d", "#fffaf2", "#050505"];
  for (let i = 0; i < amount; i += 1) {
    const confetti = document.createElement("span");
    confetti.className = "confetti-piece";
    confetti.style.left = `${Math.random() * 100}vw`;
    confetti.style.top = `${-8 - Math.random() * 18}vh`;
    confetti.style.setProperty("--drift", `${(Math.random() - 0.5) * 230}px`);
    confetti.style.setProperty("--angle", `${(Math.random() - 0.5) * 160}deg`);
    confetti.style.setProperty("--confetti-color", colors[Math.floor(Math.random() * colors.length)]);
    confetti.style.animationDelay = `${Math.random() * 520}ms`;
    document.body.appendChild(confetti);
    confetti.addEventListener("animationend", () => confetti.remove(), { once: true });
  }
}
