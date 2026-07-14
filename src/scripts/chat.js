export function initChat() {
  const body = document.getElementById("chatBody");
  if (!body) return;

  const steps = [
    "Review your resume.",
    "Practice aptitude questions.",
    "Revise OOPs, DBMS and SQL.",
    "Prepare common HR interview questions.",
    "Attempt a mock interview before the drive.",
  ];

  let played = false;
  const play = () => {
    if (played) return;
    played = true;
    setTimeout(() => {
      const wrap = document.createElement("div");
      wrap.className = "bubble bubble-ai";
      wrap.innerHTML = `Here are a few tips to prepare for Zoho:<ul></ul>`;
      body.appendChild(wrap);
      const ul = wrap.querySelector("ul");
      steps.forEach((s, i) => {
        setTimeout(() => {
          const li = document.createElement("li");
          li.textContent = s;
          li.style.opacity = "0";
          li.style.transform = "translateY(6px)";
          li.style.transition = "opacity 0.3s ease, transform 0.3s ease";
          ul.appendChild(li);
          requestAnimationFrame(() => {
            li.style.opacity = "1";
            li.style.transform = "translateY(0)";
          });
        }, i * 380);
      });
    }, 600);
  };

  const chat = document.getElementById("aiChat");
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && play()),
    { threshold: 0.4 }
  );
  io.observe(chat);
}