console.log("hi ***********");
(async function() {
	let assetMap;
	await fetch(chrome.runtime.getURL('assets/assetMap.json')).then((response) => response.json()).then((result) => assetMap = result);

	let rooms = {};
	let currentRoom = undefined;

	let soundManager = {
		audio: new Audio(),
		queue: [],
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
					url = "assets/" + name + "/" + assetMap[name][Math.floor(Math.random() * assetMap[name].length)];
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

	let dataHandler = {
		handle: function(data) {
			let lines = data.split("\n");
			if (lines[0] == "|init|battle") {
				// This is a catch-up message, ignore
				return;
			}
			for (let line of lines) {
				this.processLine(line);
			}
		},
		processLine: function(line) {
			params = line.slice(1).split("|");
			command = params[0];
			params.shift();

			switch (command) {
				case "move":
					let move = params[1];
					if (assetMap.moves.includes(move)) {
						soundManager.play(move, "move");
					}
					break;
				case "switch":
					let pokemon = params[1].split(", ")[0];
					if (assetMap.pokemon.includes(pokemon)) {
						soundManager.play(pokemon, "pokemon");
					} else {
						soundManager.play("switch");
					}
					break;
				case "drag":
					soundManager.play("switch_forced");
					break;
				case "-miss":
					// TODO: repeat misses / multi misses
					soundManager.play("miss");
					break;
				case "-weather":
					if (params[1] == "[upkeep]") {
						break;
					}
					switch (params[0]) {
						case "Sandstorm":
							soundManager.play("sand_start");
							break;
						case "RainDance":
							soundManager.play("rain_start");
							break;
						case "SunnyDay":
							soundManager.play("sun_start");
							break;
						case "none":
							switch (rooms[currentRoom].weather) {
								case "Sandstorm":
									soundManager.play("sand_end");
									break;
								case "RainDance":
									soundManager.play("rain_end");
									break;
								case "SunnyDay":
									soundManager.play("sun_end");
									break;
							}

					}
					rooms[currentRoom].weather = params[0];
					break;
				case "-fail":
					soundManager.play("fail");
					break;
				case "-activate":
					if (params[1].startsWith("move: ")) {
						let move = params[1].split(": ")[1];
						switch (move) {
							case "Protect":
							case "Detect":
							case "Baneful Bunker":
							case "Crafty Shield":
							case "King's Shield":
							case "Mat Block":
							case "Obstruct":
							case "Quick Guard":
							case "Spiky Shield":
							case "Wide Guard":
							case "Max Guard":
								soundManager.play("blocked");
								break;
							case "Substitute":
								soundManager.play("sub_hit");
								break;
						}
					}
					break;
				case "-start":
					switch (params[1]) {
						case "Substitute":
							soundManager.play("sub_start");
							break;
					}
					break;
				case "-end":
					switch (params[1]) {
						case "Disable":
							soundManager.play("disable_end");
							break;
						case "Substitute":
							soundManager.play("sub_hit");
							break;
					}
					break;
				case "-enditem":
					let item = params[1];
					let reason = params[2];
					if (reason == "[eat]") {
						// TODO
					}
					break;
				case "-immune":
					soundManager.play("no_effect");
					break;
				case "-crit":
					soundManager.play("crit");
					break;
				case "-supereffective":
					soundManager.play("supereffective");
					break;
				case "-resisted":
					soundManager.play("not_very_effective");
			}
		},
	}

	// Setup a listener to receive messages from the page
	window.addEventListener("message", (event) => {
	// We only accept messages from ourselves
	if (event.source != window) {
		return;
	}

	if (event.data.type && (event.data.type == "SHOWDOWN_ANNOUNCER")
	&& (event.data.source == "PAGE")) {
		switch (event.data.content) {
			case "SIM_DATA":
				dataHandler.handle(event.data.text)
				break;
			case "MUTE":
				soundManager.audio.muted = event.data.muted;
				break;
			case "ROOM_CHANGE":
				currentRoom = event.data.roomID
				if (!(currentRoom in rooms)) {
					rooms[currentRoom] = {
						battleStartAnnounced: false,
						weather: "none"
					};
				}
				break;
			case "TEAM_PREVIEW":
				if (!rooms[currentRoom].battleStartAnnounced) {
					rooms[currentRoom].battleStartAnnounced = true;
					soundManager.play("battle_start");
				}
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