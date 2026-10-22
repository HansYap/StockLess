// The flyer itself works without JavaScript. These are optional presentation helpers.
if (new URLSearchParams(window.location.search).get("export") === "1") {
  document.documentElement.classList.add("export");
}

const shareButton = document.getElementById("share-flyer");
if (shareButton && typeof navigator.share === "function") {
  shareButton.hidden = false;
  shareButton.addEventListener("click", async () => {
    try {
      await navigator.share({
        title: "StockLess | Stock smarter. Waste less.",
        text: "Smarter restocking for small food retailers.",
        url: "https://stockless.pages.dev/flyer/",
      });
    } catch (error) {
      // Dismissing the native share sheet leaves the flyer ready to use.
      if (error.name !== "AbortError") shareButton.hidden = true;
    }
  });
}
