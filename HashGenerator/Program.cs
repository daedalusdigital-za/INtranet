using BCrypt.Net;
var password = "Kingsland2630";
var hash = BCrypt.Net.BCrypt.HashPassword(password);
Console.WriteLine(hash);
