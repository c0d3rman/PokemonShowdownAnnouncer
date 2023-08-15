// Setup a listener to receive messages from the content script
let assetMap;
window.postMessage({
	type: "SHOWDOWN_ANNOUNCER",
	source: "PAGE",
	content: "GET_ASSETMAP"
}, "*");
window.addEventListener("message", (event) => {
	if (event.source != window) {
		return;
	}

	if (event.data.type && (event.data.type == "SHOWDOWN_ANNOUNCER")
	&& (event.data.source == "CONTENT_SCRIPT")) {
		switch (event.data.content) {
			case "GET_ASSETMAP_RESPONSE":
				assetMap = event.data.assetMap;
				break;
		}
	}
}, false);

let soundManager = {
	play: function(name, type="sound") {
		window.postMessage({
			type: "SHOWDOWN_ANNOUNCER",
			source: "PAGE",
			content: "PLAY_SOUND",
			soundName: name,
			soundType: type
		}, "*");
	}
}

// Hijack the mute function so we can mute too
let sendMuteMessage = function(muted) {
	window.postMessage({
		type: "SHOWDOWN_ANNOUNCER",
		source: "PAGE",
		content: "MUTE",
		muted: muted
	}, "*");
};
window.BattleSound._setMute_orig = window.BattleSound.setMute;
window.BattleSound.setMute = function(muted) {
	sendMuteMessage(muted); 
	window.BattleSound._setMute_orig(muted);
};
sendMuteMessage(window.BattleSound.muted); // Send initial mute data

rooms = [];

setInterval(function() {
	if (!(window.room && window.room.battle && !rooms.includes(window.room.id))) {
		return;
	}

	rooms.push(window.room.id);
	let room = window.room;

	room.battle.scene._teamPreview_orig = room.battle.scene.teamPreview;
	room.battle.scene.teamPreview = function() {
		soundManager.play("battle_start");

		room.battle.scene._teamPreview_orig();
		// Never do it again after the first time
		room.battle.scene.teamPreview = room.battle.scene._teamPreview_orig;
	}

	let currentWeather = "";

	let dataHandler = {
		currentMove: {},
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
				case "":
					this.completeMove();
					break;
				case "move":
					this.completeMove();

					let move = params[1];
					this.currentMove = {"name": move, "target": params[2]};
					if (assetMap.moves.includes(move)) {
						soundManager.play(move, "move");
					}
					break;
				case "switch":
					this.completeMove();

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
					this.currentMove.miss = true;
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
							switch (currentWeather) {
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
					currentWeather = params[0];
					break;
				case "-fail":
					this.currentMove.fail = true;
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
					this.currentMove.no_effect = true;
					break;
				case "-crit":
					this.currentMove.crit = true;
					break;
				case "-supereffective":
					this.currentMove.supereffective = true;
					break;
				case "-resisted":
					this.currentMove.resisted = true;
					break;
				case "-damage":
					// If there's an active move and its target just got damaged
					if (this.currentMove.name && params[0] == this.currentMove.target) {
						let hpStr = params[1].split(" ")[0];

						let newHP;
						if (hpStr == "0") {
							newHP = 0
						} else {
							let hpParts = hpStr.split("/");
							newHP = hpParts[0] / hpParts[1];
						}

						let targetSide = this.currentMove.target.slice(0, 2);
						let target = room.battle.getSide(targetSide).active[0];
						let oldHP = target.hp / target.maxHP;

						this.currentMove.hpBefore = oldHP
						this.currentMove.hpAfter = newHP;
					}
					break;
				case "cant":
					if (params[1] == "flinch") {
						soundManager.play("flinch");
					}
					break;
			}
		},
		completeMove: function() {
			if (!this.currentMove.name) {
				return;
			}

			if (this.currentMove.no_effect) {
				soundManager.play("no_effect");
			} else if (this.currentMove.miss) {
				soundManager.play("miss");
			} else if (this.currentMove.hpAfter) {
				if (this.currentMove.crit) {
					soundManager.play("attack_crit");
				} else if (this.currentMove.supereffective) {
					soundManager.play("supereffective");
				} else if (this.currentMove.resisted) {
					soundManager.play("not_very_effective");
				}
				
				if (this.currentMove.hpAfter == 0) {
					if (room.battle.turn == 1) {
						soundManager.play("ko_firstturn");
					} else if (this.currentMove.hpBefore == 1) {
						soundManager.play("ko_ohko");
					} else if (this.currentMove.hpBefore < 0.25) {
						soundManager.play("ko_lighthit");
					} else {
						soundManager.play("ko");
					}
				} else {
					let damage = this.currentMove.hpAfter - this.currentMove.hpBefore;
					if (this.currentMove.hpAfter < 0.25) {
						soundManager.play("attack_redhealth");
					} else if (damage > 0.5) {
						if (room.battle.turn == 1) {
							soundManager.play("attack_strong_firstturn");
						} else if (this.currentMove.resisted) {
							soundManager.play("attack_strong_nve");
						} else {
							soundManager.play("attack_strong");
						}
					} else if (damage < 0.25) {
						soundManager.play("attack_lighthit");
					} else {
						soundManager.play("attack");
					}
				}
			}

			this.currentMove = {};
		}
	}

	// Hijack the function that receives Sim Protocol messages from the server
	room.receive = function(data) {
		// Handle the data
		dataHandler.handle(data)
		
		// Make sure the room gets the data too
		this.add(data);
	};
}, 100);