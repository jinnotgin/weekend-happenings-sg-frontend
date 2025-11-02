class SafariUiDetector {
	constructor() {
		this.isIOS =
			/iPad|iPhone|iPod/.test(window.navigator.userAgent) && !window.MSStream;
		this.isStandalone = window.navigator.standalone === true;
		this.hasDynamicUi = false;

		if (this.isIOS && !this.isStandalone && window.visualViewport) {
			this.runDetection();
		}
	}

	runDetection() {
		const initialHeight = window.visualViewport.height;
		const uiGap = window.innerHeight - initialHeight;

		if (uiGap > 30) {
			document.documentElement.classList.add("has-initial-browser-ui");
			document.documentElement.classList.add("has-safari-floating-bar");
		}

		const confirmOnScroll = () => {
			if (window.visualViewport.height > initialHeight) {
				this.hasDynamicUi = true;
				document.documentElement.classList.add("has-dynamic-browser-ui");
				window.visualViewport.removeEventListener("resize", confirmOnScroll);
			}
		};

		window.visualViewport.addEventListener("resize", confirmOnScroll, {
			once: false,
		});
	}
}

let detector;

export function initSafariUiDetector() {
	if (detector) {
		return detector;
	}
	detector = new SafariUiDetector();
	return detector;
}
