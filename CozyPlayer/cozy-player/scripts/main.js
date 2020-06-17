// Automaticaly close sheets when rolling for something
Hooks.once('ready', () => {
  const originalMethod = Roll.prototype.toMessage;
  Roll.prototype.toMessage = function (chatData={}, {rollMode=null, create=true}={}) {
    //insertFlavorTargets(chatData); // WIP
    closeSheets();
    return originalMethod.apply(this, arguments);
  };
});

Hooks.on('chatMessage', (chatLog, message, chatData) => {
    let [command, match] = chatLog.constructor.parse(message);
    if (!match) throw new Error("Unmatched chat command");

    if(["roll", "gmroll", "blindroll", "selfroll"].includes(command)) {
        closeSheets();
        return true;
    }
});


// Confort Shortcuts on default bar
Hooks.on('getSceneControlButtons', controls => {
	let control = controls.find(c => c.name === "token") || controls[0];
	
	control.tools.push({
		name: "perception",
		title: "Perception",
		icon: "fas fa-eye",
		visible: game.settings.get("cozy-player", "toolbarShowSkills"),
		onClick: () => {
      rollSkill('prc');
      control.activeTool = "select";
			return;
		}
	});
  
	control.tools.push({
		name: "insight",
		title: "Insight",
		icon: "fas fa-brain",
		visible: game.settings.get("cozy-player", "toolbarShowSkills"),
		onClick: () => {
      rollSkill('ins');
      control.activeTool = "select";
			return;
		}
	});
	
	control.tools.push({
		name: "investigation",
		title: "Investigation",
		icon: "fas fa-search",
		visible: game.settings.get("cozy-player", "toolbarShowSkills"),
		onClick: () => {
      rollSkill('inv');
      control.activeTool = "select";
			return;
		}
	});  
  
	control.tools.push({
		name: "rollinitiative",
		title: "Roll Initiative",
		icon: "fas fa-flag-checkered",
		visible: game.settings.get("cozy-player", "toolbarTurnTools"),
		onClick: () => {
      control.activeTool = "select";
			enterCombatAndRollInitative();
		}
	});
	
	control.tools.push({
		name: "endturn",
		title: "End Turn",
		icon: "fas fa-step-forward",
		visible: game.settings.get("cozy-player", "toolbarTurnTools"),
		onClick: () => {
      control.activeTool = "select";
			endTurn();
		}
	});
});

// ----------------------------------------------------------------------------------
async function rollSkill(skillName)
{
	var controlled = canvas.tokens.controlled;
	var actors = [];
	var tgTkn;
	
	if( controlled.length == 0 ) controlled = canvas.tokens.ownedTokens;
  
  if( controlled.length == 0 ) {
    actors.push( game.user.character );
  } else {
    for (let i = 0; i < controlled.length; i++) {
      var tkn = controlled[i];
      actors.push( tkn.actor );
    }
  }
  
  for (let i = 0; i < actors.length; i++) {
    actors[i].rollSkill(skillName);
  }
}

async function enterCombatAndRollInitative()
{
	
	/* 
	// Reference: how to create a combat... useful for when the player wants to start a combat
	// WIP
	if(!game.combat) {
		let scene = game.scenes.viewed;
		if ( !scene ) return;
		let cbt = await game.combats.object.create({scene: scene._id});
		await cbt.activate();
	}
	*/
	
	if(!game.combat && !game.user.isGM ) {
		return;
	}
	
	// Get Selected Tokens
	var controlled = canvas.tokens.controlled;
	var notInCombat = [];
	var tgTkn;
	
	if( controlled.length == 0 )
	{
		controlled = canvas.tokens.ownedTokens;
	}
	
	for (let i = 0; i < controlled.length; i++) {
		var tkn = controlled[i];
		if( !tkn.inCombat )
		{
			tgTkn = tkn;
			notInCombat.push(tkn.id);
		}
	}
	
	
	// If any token was marked, toggle combat.
	// For some reason, all selected tokens will be toggled to combat...
	if(tgTkn)
	{
		await tgTkn.toggleCombat();
	}
	
	// Get combatants that was not in combat before
	var toRoll = [];
	for (let i = 0; i < notInCombat.length; i++) {
			var tokenId = notInCombat[i];
			var combatant = await game.combat.getCombatantByToken(tokenId);
			if(combatant)
			{
				toRoll.push(combatant._id);
			}
	}
	
	// Roll for selected tokens that was not in combat before
	if( toRoll.length > 0 )
	{
		game.combat.rollInitiative(toRoll);
	}
}

// Close opened sheets
async function closeSheets()
{
  if(!game.settings.get("cozy-player", "sheetsMinimizeOnRoll")) return;
  
	for(appId in ui.windows)
	{
		const win = ui.windows[appId];
		if(win && win.options && win.options.baseApplication == "ActorSheet")
		{
			win.minimize();
		}
	}
	return;
}

// Get Selected Targets (returns a token list)
function getSelectedTargets()
{
  let targetList = [];
  
  const targets = game.user.targets.values();
  for(let target = targets.next(); !target.done; target = targets.next())
  {
    targetList.push(target.value);
  }
  
  return targetList;
}

// Insert skill targets on flavor text
function insertFlavorTargets(chatData)
{
    if(chatData.flavor.includes("Attack Roll")) {
      let targetsString = "";
      let targets = getSelectedTargets();
      
      if(targets.length > 0) {
        targetsString += "<br>targets: ";
      }
      
      let first = true;
      for(let i = 0; i < targets.length; i++) {
        let target = targets[i];
        if(first) first = false;
        else targetsString += ", ";
        targetsString += target.name;
      }
      
      chatData.flavor += targetsString;
    }
}

// Designed to player end current turn if its owner of current turn actor
async function endTurn()
{
	var combatant = game.combat.combatant;
	if(combatant && combatant.actor && combatant.actor.permission == ENTITY_PERMISSIONS["OWNER"] )
	{
		game.combat.nextTurn();
	}
}