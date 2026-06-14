namespace VideoViewer.Web.Services;

using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

public record AuthConfig
{
    public string Pin { get; init; } = string.Empty;
    public string JwtSecret { get; init; } = string.Empty;
    public int TokenLifetimeMinutes { get; init; } = 60;
}

public interface IPinAuthService
{
    string CreateToken(string pin);
    bool ValidatePin(string pin);
}

public class PinAuthService : IPinAuthService
{
    private readonly AuthConfig _config;
    private readonly byte[] _secretKey;

    public PinAuthService(IOptions<AuthConfig> config)
    {
        _config = config.Value;

        if (string.IsNullOrWhiteSpace(_config.Pin))
        {
            throw new ArgumentException("PIN must be configured in VideoViewer:Auth:Pin.");
        }

        if (string.IsNullOrWhiteSpace(_config.JwtSecret) || _config.JwtSecret.Length < 16)
        {
            throw new ArgumentException("JWT secret must be configured in VideoViewer:Auth:JwtSecret and be at least 16 characters long.");
        }

        _secretKey = Encoding.UTF8.GetBytes(_config.JwtSecret);
    }

    public bool ValidatePin(string pin)
    {
        return string.Equals(pin, _config.Pin, StringComparison.Ordinal);
    }

    public string CreateToken(string pin)
    {
        if (!ValidatePin(pin))
        {
            throw new UnauthorizedAccessException("Invalid PIN");
        }

        var claims = new List<Claim>
        {
            new Claim(JwtRegisteredClaimNames.Sub, "videoviewer"),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new Claim("auth_method", "pin")
        };

        var credentials = new SigningCredentials(new SymmetricSecurityKey(_secretKey), SecurityAlgorithms.HmacSha256);
        var expiresAt = DateTime.UtcNow.AddMinutes(_config.TokenLifetimeMinutes);

        var token = new JwtSecurityToken(
            claims: claims,
            expires: expiresAt,
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
