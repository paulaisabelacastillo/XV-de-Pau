const EVENT_DATE = new Date("2026-07-11T19:00:00-05:00");
const SPOTIFY_TRACK_URI = "spotify:track:2lTm559tuIvatlT1u0JYG2";
const SPOTIFY_IFRAME_API_URL = "https://open.spotify.com/embed/iframe-api/v1";
const FORMSPREE_SONG_ENDPOINT = "https://formspree.io/f/xeewvdjb";
const FIREBASE_SDK_VERSION = "10.12.5";
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDzY1PY2ZR5z6dk1Vkqg1KsJm8-mSaSGao",
  authDomain: "xvpau-cc190.firebaseapp.com",
  projectId: "xvpau-cc190",
  storageBucket: "xvpau-cc190.firebasestorage.app",
  messagingSenderId: "876809357381",
  appId: "1:876809357381:web:9d2ebb1cd463027fe83b2c",
  measurementId: "G-0EZBRM64QE",
};
const STORAGE_KEYS = {
  whatsapp: "xv_pau_whatsapp_confirmed",
  rsvpEmail: "xv_pau_rsvp_email",
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
let firebaseClientPromise = null;

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

const introVideo = $("#introVideo");
const introPlayButton = $("#introPlayButton");
const introVideoStatus = $("#introVideoStatus");

function updateIntroVideoButton(isPlaying) {
  introPlayButton?.classList.toggle("is-playing", isPlaying);
  introPlayButton?.setAttribute(
    "aria-label",
    isPlaying ? "Pausar video" : "Reproducir video",
  );
}

introPlayButton?.addEventListener("click", async () => {
  if (!introVideo) return;

  if (!introVideo.paused) {
    introVideo.pause();
    updateIntroVideoButton(false);
    return;
  }

  try {
    await pauseMusic();
    introVideo.controls = true;
    await introVideo.play();
    updateIntroVideoButton(true);
    if (introVideoStatus) introVideoStatus.textContent = "";
  } catch (error) {
    console.warn("No se pudo reproducir el video especial.", error);
    if (introVideoStatus) introVideoStatus.textContent = "Video no disponible";
    updateIntroVideoButton(false);
  }
});

introVideo?.addEventListener("play", () => updateIntroVideoButton(true));
introVideo?.addEventListener("pause", () => updateIntroVideoButton(false));
introVideo?.addEventListener("ended", () => updateIntroVideoButton(false));

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

async function getFirebaseClient() {
  if (!firebaseClientPromise) {
    const appUrl = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`;
    const firestoreUrl = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-firestore.js`;
    firebaseClientPromise = Promise.all([import(appUrl), import(firestoreUrl)]).then(
      ([appModule, firestoreModule]) => {
        const app = appModule.initializeApp(FIREBASE_CONFIG);
        return {
          db: firestoreModule.getFirestore(app),
          doc: firestoreModule.doc,
          getDoc: firestoreModule.getDoc,
          updateDoc: firestoreModule.updateDoc,
        };
      },
    );
  }

  return firebaseClientPromise;
}

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

function getGuestNames(inviteData) {
  if (Array.isArray(inviteData.nombres)) return inviteData.nombres.filter(Boolean).join(", ");
  return inviteData.nombres || inviteData.nombre || inviteData.invitados || "Invitado";
}

function getGuestSeats(inviteData) {
  return Number(inviteData.cupos ?? inviteData.cantidadCupos ?? inviteData.cantidad ?? 0);
}

async function findInviteByEmail(firebase, email) {
  const directRef = firebase.doc(firebase.db, "invitados", email);
  const directSnapshot = await firebase.getDoc(directRef);
  if (!directSnapshot.exists()) return null;
  return { data: directSnapshot.data(), ref: directRef };
}

function getFirebaseErrorMessage(error) {
  if (error?.code === "permission-denied") {
    return "Firebase bloqueó la búsqueda. Publica las reglas de Firestore para permitir leer invitados.";
  }

  if (error?.code === "unavailable") {
    return "Firebase no está disponible ahora. Revisa la conexión e intenta de nuevo.";
  }

  return "No pude conectar con Firebase. Intenta de nuevo.";
}

function getFirebaseSaveErrorMessage(error) {
  if (error?.code === "permission-denied") {
    return "Firebase bloqueó la confirmación. Publica las reglas de Firestore para actualizar confirmacion.";
  }

  return "No pude guardar la confirmación. Intenta de nuevo.";
}

const rsvpLookupForm = $("#rsvpLookupForm");
const guestEmailInput = $("#guestEmail");
const rsvpResult = $("#rsvpResult");
const rsvpStatus = $("#rsvpStatus");
const guestNamesTarget = $("#guestNames");
const guestSeatsTarget = $("#guestSeats");
const firebaseConfirmButton = $("#firebaseConfirmButton");
let currentInvite = null;

if (guestEmailInput) {
  guestEmailInput.value = localStorage.getItem(STORAGE_KEYS.rsvpEmail) || "";
}

function setRsvpStatus(message, type = "info") {
  if (!rsvpStatus) return;
  rsvpStatus.textContent = message;
  rsvpStatus.dataset.type = type;
}

rsvpLookupForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = normalizeEmail(guestEmailInput?.value || "");
  if (!email) return;

  localStorage.setItem(STORAGE_KEYS.rsvpEmail, email);
  setRsvpStatus("Buscando invitación...");
  if (rsvpResult) rsvpResult.hidden = true;

  try {
    const firebase = await getFirebaseClient();
    const invitation = await findInviteByEmail(firebase, email);

    if (!invitation) {
      currentInvite = null;
      setRsvpStatus("No encontré una invitación con ese email.", "error");
      return;
    }

    const inviteData = invitation.data;
    const nombres = getGuestNames(inviteData);
    const cupos = getGuestSeats(inviteData);
    currentInvite = { cupos, email, guestRef: invitation.ref, nombres };

    if (guestNamesTarget) guestNamesTarget.textContent = nombres;
    if (guestSeatsTarget) guestSeatsTarget.textContent = String(cupos);
    if (rsvpResult) rsvpResult.hidden = false;
    setRsvpStatus(inviteData.confirmacion ? "Esta invitación ya aparece confirmada." : "");
  } catch (error) {
    console.error(error);
    setRsvpStatus(getFirebaseErrorMessage(error), "error");
  }
});

firebaseConfirmButton?.addEventListener("click", async () => {
  if (!currentInvite) {
    setRsvpStatus("Primero busca tu invitación por email.", "error");
    return;
  }

  setRsvpStatus("Confirmando asistencia...");
  try {
    const firebase = await getFirebaseClient();
    await firebase.updateDoc(currentInvite.guestRef, { confirmacion: true });
    localStorage.setItem(STORAGE_KEYS.whatsapp, new Date().toISOString());
    setRsvpStatus("Asistencia confirmada.");
    createSparkBurst(window.innerWidth / 2, window.innerHeight * 0.45, 18);
  } catch (error) {
    console.error(error);
    setRsvpStatus(getFirebaseSaveErrorMessage(error), "error");
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
  for (let i = 0; i < amount; i += 1) {
    const spark = document.createElement("span");
    spark.className = "tap-spark";
    spark.style.left = `${x}px`;
    spark.style.top = `${y}px`;
    spark.style.setProperty("--spark-x", `${(Math.random() - 0.5) * 140}px`);
    spark.style.setProperty("--spark-y", `${-30 - Math.random() * 110}px`);
    document.body.appendChild(spark);
    spark.addEventListener("animationend", () => spark.remove(), { once: true });
  }
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

document.addEventListener("pointerdown", (event) => {
  createSparkBurst(event.clientX, event.clientY, 4);
});

// Ripple tactil en botones y enlaces destacados.
$$("button, .solid-button, .scroll-button, .whatsapp-button").forEach((element) => {
  element.addEventListener("pointerdown", (event) => {
    const rect = element.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "ripple";
    ripple.style.left = `${event.clientX - rect.left - 9}px`;
    ripple.style.top = `${event.clientY - rect.top - 9}px`;
    element.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
  });
});
