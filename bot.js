var Discord = require('discord.io');
var logger = require('winston');
var auth = require('./auth.json');
var axios = require('axios');


// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';

let yesterday = ''
let scoreMessage = ''
const retrieveScores = function (bot, channelID, dayEalierNumber = 0, triCode = '') {
    axios.get(`https://data.nba.net/10s/prod/v1/${yesterday}/scoreboard.json`)
    .then(response => {
        let games = getGameList(response, triCode)

        const nonEndedGames = games.filter(function (game) {
            return game.endTimeUTC == undefined
        })
        if (nonEndedGames.length > 0) {
            yesterday = getYesterday(dayEalierNumber + 1)
            retrieveScores(bot, channelID, dayEalierNumber + 1, triCode)
            return
        }
        scoreMessage = getScoreMessage(games)
        bot.sendMessage({
            to: channelID,
            message: scoreMessage
        });
    })
    .catch(error => {
        console.log(error);
    });
}

const getGameList = function (response, triCode) {
    if (triCode === '') {
        return response.data.games
    }
    const team = response.data.games.filter(function (game) {
        return game.hTeam.triCode === triCode || game.vTeam.triCode === triCode 
    })

    return team
}

const getScoreMessage = function (games) {
    scoreMessage = ''
    games.forEach(function(game) {
        const homeTeam = game.hTeam
        const awayTeam = game.vTeam
        const teams = `___**${homeTeam.triCode}**___ VS ___**${awayTeam.triCode}**___`
        const scores =  homeTeam.score + ' - ' + awayTeam.score
        const homeLineScore = homeTeam.linescore.reduce((acc, cur) => acc + ` ${cur.score} `, '')
        const awayLineScore = awayTeam.linescore.reduce((acc, cur) => acc + ` ${cur.score} `, '')
        const details = (`*(${homeLineScore.trim()}) - (${awayLineScore.trim()})*`)
        const nugget = `Haut fait: ${game.nugget.text}`
        scoreMessage += `${teams}\n ${scores}\n${details}\n${nugget}\n\n`
    })

    return scoreMessage
}

const getYesterday = function (dayEalierNumber = 0) {
    var currentDate = new Date()
    currentDate.setDate((currentDate.getDate() - dayEalierNumber) - 1)
    var dd = currentDate.getDate()
    var mm = currentDate.getMonth() + 1
    var yyyy = currentDate.getFullYear()
    if (dd < 10) {
        dd = '0' + dd
    }
    if (mm < 10) {
        mm = '0' + mm
    }
    currentDate = yyyy + mm + dd
    
    return currentDate
}

const printScores = function (bot, channelID, triCode) {

    const newYesterday = getYesterday()
    const dayChanged = newYesterday !== yesterday
    if (dayChanged) {
        yesterday = newYesterday
    }

    if (scoreMessage === '' || dayChanged) {
        retrieveScores(bot, channelID, 0, triCode)
        return;
    }
    bot.sendMessage({
        to: channelID,
        message: scoreMessage
    });
}


// Initialize Discord Bot
var bot = new Discord.Client({
   token: auth.token,
   autorun: true
});
bot.on('ready', function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');
});
bot.on('message', function (user, userID, channelID, message, evt) {
    if (message.substring(0, 1) == '!') {
        var args = message.substring(1).split(' ');
        var cmd = args[0];
       
        args = args.splice(1);

        switch(cmd) {
            case 'result':
                printScores(bot, channelID)
                break
            default:
                if (cmd.length !== 3) {
                    break
                }
                printScores(bot, channelID, cmd.toUpperCase())
         }
     }
});