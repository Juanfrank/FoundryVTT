"use strict"

export class DiceNotation {

	constructor(notation, factory) {

		/* if (typeof notation == 'object') {
			notation = notation.notation;
		} */

		this.set = [];
		this.setkeys = [];
		this.setid = 0;
		this.groups = [];
		this.totalDice = 0;
		this.op = '';
		this.constant = '';
		this.result = [];
		this.error = false;
		this.boost = 1;
		this.notation = notation;
		this.vectors = [];
		this.owner = -1;
		this.factory = factory;

		if (!notation || notation =='0') {
			this.error = true;
		}

		let notationdata = this.notation;

		notationdata = notationdata.split(' ').join(''); // remove spaces

		//count group starts and ends
		let groupstarts = notationdata.split('(').length-1;
		let groupends = notationdata.split(')').length-1;
		if (groupstarts != groupends) this.error = true;


		let no = notationdata.split('@');// 0: dice notations, 1: forced results
		let rollregex = new RegExp(/(\+|\-|\*|\/|\%|\^|){0,1}()(\d*)([a-z]{1,5}\d+|[a-z]{1,5}|)(?:\{([a-z]+)(.*?|)\}|)()/, 'i');
		let resultsregex = new RegExp(/(\b)*(\-\d+|\d+)(\b)*/, 'gi'); // forced results: '1, 2, 3' or '1 2 3'
		let res;

		let runs = 0;
		let breaklimit = 30;
		let groupLevel = 0;
		let groupID = 0;

		// dice notations
		let notationstring = no[0];
		while (!this.error && notationstring.length > 0 && (res = rollregex.exec(notationstring)) !== null && runs < breaklimit) {
			runs++;

			//remove this notation so we can move on next iteration
			notationstring = notationstring.substring(res[0].length);

			let operator = res[1];
			let groupstart = res[2] && res[2].length > 0;
			let amount = res[3];
			let type = res[4];
			let funcname = res[5] || '';
			let funcargs = res[6] || '';
			let groupend = res[7] && res[7].length > 0;
			let addset = true;

			// individual groups get a unique id so two seperate groups at the same level don't get combined later
			if (groupstart) {
				groupLevel += res[2].length;
			}

			// if this is true, we have a single operator and constant as the whole notation string
			// e.g. '+7', '*4', '-2'
			// in this case, assume a d20 is to be rolled
			if ((runs == 1 && notationstring.length == 0) && !type && operator && amount) {
				
				type = 'd20';
				this.op = operator;
				this.constant = parseInt(amount);
				amount = 1;

			// in this case, we've got other sets and this is just an ending operator+constant
			} else if ((runs > 1 && notationstring.length == 0) && !type) {
				this.op = operator;
				this.constant = parseInt(amount);
				addset = false;
			}

			if (addset) this.addSet(amount, type, groupID, groupLevel, funcname, funcargs, operator);
			
			if (groupend) {
				groupLevel -= res[7].length;
				groupID += res[7].length;
			}
		}

		// forced results
		if (!this.error && no[1] && (res = no[1].match(resultsregex)) !== null) {
			this.result.push(...res);
		}
	}

	stringify(full = true) {

		let output = '';

		if (this.set.length < 1) return output;

		for(let i = 0; i < this.set.length; i++){
			let set = this.set[i];

			output += (i > 0 && set.op) ? set.op : '';
			output += set.num + set.type;
			if(set.func) {
				output += '{';
				output += (set.func) ? set.func : '';
				output += (set.args) ? ','+(Array.isArray(set.args) ? set.args.join(',') : set.args) : '';
				output += '}';
			}
		}

		output += (this.constant) ? this.op+''+Math.abs(this.constant) : '';

		if(full && this.result && this.result.length > 0) {
			output += '@'+this.result.join(',');
		}

		if (this.boost > 1) {
			output += ('!'.repeat((this.boost/4)));
		}
		return output;
	}

	addSet(amount, type, groupID = 0, groupLevel = 0, funcname = '', funcargs = '', operator = '+') {

		let diceobj = this.factory.get(type);
		if (diceobj == null) { this.error = true; return; }

		amount = Math.abs(parseInt(amount || 1));

		// update a previous set if these match
		// has the added bonus of combining duplicate
		let setkey = operator+''+type+''+groupID+''+groupLevel+''+funcname+''+funcargs;
		let update = (this.setkeys[setkey] != null);

		let setentry = {};
		if (update) {
			setentry = this.set[(this.setkeys[setkey]-1)];
		}
		/* setentry = {
			num: 0,
			type: '',
			gid: 0,
			glvl: 0,
			func: '',
			arg: 0,
			op: '',
		} */
		if (amount > 0) {

			setentry.num = update ? (amount + setentry.num) : amount;
			setentry.type = diceobj.type;
			setentry.sid = this.setid;
			setentry.gid = groupID;
			setentry.glvl = groupLevel;
			if (funcname) setentry.func = funcname;
			if (funcargs) setentry.args = funcargs;
			if (operator) setentry.op = operator;

			if (!update)  {
				this.setkeys[setkey] = this.set.push(setentry);
			} else {
				this.set[(this.setkeys[setkey]-1)] = setentry;
			}
		}

		if (!update) ++this.setid;
	}

}