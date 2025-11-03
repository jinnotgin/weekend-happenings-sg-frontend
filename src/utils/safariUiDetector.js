const IOS_VERSION_PATTERN = /OS (\d+)_/i;
const SAFARI_PATTERN = /Safari/i;
const CRHOME_AND_FRIENDS_PATTERN = /CriOS|FxiOS|EdgiOS|OPiOS/i;

const isWindowAvailable = () => typeof window !== "undefined";

const extractIOSMajorVersion = (userAgent) => {
	const match = userAgent.match(IOS_VERSION_PATTERN);
	if (!match) {
		return null;
	}

	const majorVersion = Number.parseInt(match[1], 10);
	return Number.isNaN(majorVersion) ? null : majorVersion;
};

const isIOSDevice = (userAgent, msStream) =>
	/iPad|iPhone|iPod/.test(userAgent) && !msStream;

const isStandaloneMode = (navigator) => navigator?.standalone === true;

const isSafariBrowser = (userAgent) =>
	SAFARI_PATTERN.test(userAgent) && !CRHOME_AND_FRIENDS_PATTERN.test(userAgent);

export const MIN_SUPPORTED_IOS_VERSION = 26;

/**
 * Returns true when the current runtime matches iOS/iPadOS Safari (non-standalone)
 * at or above the specified minimum major version.
 */
export function shouldHideForSafariFloatingBar() {
	if (!isWindowAvailable()) {
		return false;
	}

	const { navigator, MSStream } = window;

	if (!navigator) {
		return false;
	}

	const userAgent = navigator.userAgent || "";

	if (!isIOSDevice(userAgent, MSStream)) {
		return false;
	}

	if (!isSafariBrowser(userAgent)) {
		return false;
	}

	if (isStandaloneMode(navigator)) {
		return false;
	}

	const iosVersion = extractIOSMajorVersion(userAgent);

	if (iosVersion === null) {
		return false;
	}

	return iosVersion >= MIN_SUPPORTED_IOS_VERSION;
}
