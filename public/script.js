function updateClock() {
    const clockElement = document.getElementById("clock");
  
    const now = new Date();
  
    const dateText = now.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  
    const timeText = now.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  
    clockElement.textContent = `${dateText} · ${timeText}`;
  }
  
  updateClock();
  setInterval(updateClock, 1000);