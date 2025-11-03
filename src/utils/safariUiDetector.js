const IOS_VERSION_PATTERN = /OS (\d+)_/i;

const isWindowAvailable = () => typeof window !== "undefined";

const isIOSDevice = (userAgent, msStream) =>
	/iPad|iPhone|iPod/.test(userAgent) && !msStream;

const extractIOSMajorVersion = (userAgent) => {
	const match = userAgent.match(IOS_VERSION_PATTERN);
	if (!match) {
		return null;
	}

	const majorVersion = Number.parseInt(match[1], 10);
	return Number.isNaN(majorVersion) ? null : majorVersion;
};

export const MIN_SUPPORTED_IOS_VERSION = 26;

/**
 * Detects Safari's floating address bar behaviour and executes a callback once it is observed.
 * Returns a cleanup function to stop listening to viewport changes.
 */
export function observeSafariFloatingBar(onFloatingBarDetected) {
	if (!isWindowAvailable()) {
		return () => {};
	}

	const { navigator, visualViewport, innerHeight, MSStream } = window;

	if (!navigator || !visualViewport) {
		return () => {};
	}

	const userAgent = navigator.userAgent || "";

	if (!isIOSDevice(userAgent, MSStream)) {
		return () => {};
	}

	if (navigator.standalone === true) {
		return () => {};
	}

	const iosVersion = extractIOSMajorVersion(userAgent);

	if (iosVersion !== null && iosVersion < MIN_SUPPORTED_IOS_VERSION) {
		return () => {};
	}

	let hasDetected = false;
	let cleanup = null;
	const initialHeight = visualViewport.height;
	const uiGap = innerHeight - initialHeight;

	const triggerDetection = () => {
		if (hasDetected) {
			return;
		}
		hasDetected = true;
		if (typeof onFloatingBarDetected === "function") {
			onFloatingBarDetected();
		}
		if (cleanup) {
			cleanup();
			cleanup = null;
		}
	};

	if (uiGap > 30) {
		triggerDetection();
	}

	const handleViewportResize = () => {
		if (visualViewport.height > initialHeight) {
			triggerDetection();
		}
	};

	visualViewport.addEventListener("resize", handleViewportResize, {
		once: false,
	});

	cleanup = () => {
		visualViewport.removeEventListener("resize", handleViewportResize);
	};

	return () => {
		if (cleanup) {
			cleanup();
			cleanup = null;
		}
	};
}
