// This content script handles:
// - Injecting the main script into the page
// - Playing sounds when requested by the main script

(async function() {
	let assetMap;
	await fetch(chrome.runtime.getURL('assets/assetMap.json')).then((response) => response.json()).then((result) => assetMap = result);

	let soundManager = {
		audio: new Audio(),
		queue: [],
		soundsPlayed: {},
		play: function(name, type="sound") {
			let url;

			switch (type) {
				case "move":
					if (!assetMap.moves.includes(name)) {
						return;
					}
					url = "assets/moves/" + name + ".wav";
					break;
				case "pokemon":
					if (!assetMap.pokemon.includes(name)) {
						return;
					}
					url = "assets/pokemon/" + name + ".wav";
					break;
				case "sound":
					let urlBase = "assets/" + name + "/";	

					let all = assetMap[name];
					let minTimesPlayed = all.reduce((x, y) => Math.min(x, this.soundsPlayed[urlBase + y]) || 0, Infinity);
					let candidates = all.filter((x) => (this.soundsPlayed[urlBase + x] || 0) == minTimesPlayed);

					url = urlBase + candidates[Math.floor(Math.random() * candidates.length)];
					break;
				default:
					throw "Unknown play type " + type;
			}

			if (this.audio.paused || this.audio.ended) {
				this._play(url);
			} else {
				this.queue.push(url);
			}
		},
		_play: function(url) {
			if (!(url in this.soundsPlayed)) {
				this.soundsPlayed[url] = 0;
			}
			this.soundsPlayed[url]++;
			this.audio.src = chrome.runtime.getURL(url);
			this.audio.play();
		},
		init: function() {
			let self = this;
			this.audio.addEventListener('ended', function(){
				if (self.queue.length > 0) {
					self._play(self.queue.shift());
				}
			}, false);
		}
	}
	soundManager.init();

	// Setup a listener to receive messages from the page
	window.addEventListener("message", (event) => {
		if (event.source != window) {
			return;
		}

		if (event.data.type && (event.data.type == "SHOWDOWN_ANNOUNCER")
		&& (event.data.source == "PAGE")) {
			switch (event.data.content) {
				case "PLAY_SOUND":
					soundManager.play(event.data.soundName, event.data.soundType)
					break;
				case "MUTE":
					soundManager.audio.muted = event.data.muted;
					break;
				case "GET_ASSETMAP":
					window.postMessage({
						type: "SHOWDOWN_ANNOUNCER",
						source: "CONTENT_SCRIPT",
						content: "GET_ASSETMAP_RESPONSE",
						assetMap: assetMap
					}, "*");
					break;
			}
		}
	}, false);

	// Inject the script into the page to gain access to the page's true window object
	let s = document.createElement('script');
	s.src = chrome.runtime.getURL('inject.js');
	s.onload = function() {
		this.remove();
	};
	(document.head || document.documentElement).appendChild(s);
})();