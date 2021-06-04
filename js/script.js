$(document).ready(function () {

 // OPEN WEATHER CALL: https://api.openweathermap.org/data/2.5/onecall?lat={lat}&lon={lon}&exclude={part}&appid={API key}

var APIKey = "";
var cityArray = [];


 // Store
localStorage.setItem("citySearch", "result");

// Retrieve
document.getElementById("result").innerHTML = localStorage.getItem("citySearch");