document.documentElement.classList.add("has-js");

const year = document.getElementById("year");
if (year) {
  year.textContent = String(new Date().getFullYear());
}

const navigationToggle = document.querySelector(".nav-toggle");
const navigation = document.getElementById("site-navigation");

if (navigationToggle && navigation) {
  const closeNavigation = () => {
    navigation.classList.remove("is-open");
    navigationToggle.setAttribute("aria-expanded", "false");
  };

  navigationToggle.addEventListener("click", () => {
    const isOpen = navigation.classList.toggle("is-open");
    navigationToggle.setAttribute("aria-expanded", String(isOpen));
  });

  navigation.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeNavigation);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeNavigation();
    }
  });
}
