
// Toggles mobile navbar when item selected
$('.navbar-collapse ul li a').click(function() {
    $('.navbar-toggle:visible').click();
});

$(document).ready(function() {
    $('form').submit(function (e) {
        e.preventDefault();
        $.get('/points-api/' + $('#input-name').val(), {}, printPoints);
        //$.post('/points-api', {name: $('#input-name').val()}, printPoints);
        //this.reset();
    });
});

function printPoints(data) {
    console.log("Data received: ", JSON.stringify(data));
};
