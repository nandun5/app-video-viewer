namespace VideoViewer.Controllers;

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;
using VideoViewer.Web.Services;

[ApiController]
[AllowAnonymous]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IPinAuthService _pinAuthService;
    private readonly AuthConfig _authConfig;

    public AuthController(IPinAuthService pinAuthService, IOptions<AuthConfig> authConfig)
    {
        _pinAuthService = pinAuthService;
        _authConfig = authConfig.Value;
    }

    [HttpPost("pin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public IActionResult AuthenticateWithPin([FromBody] PinRequest request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Pin) || request.Pin.Length != 6)
        {
            return Unauthorized(new { error = "Invalid PIN" });
        }

        try
        {
            var token = _pinAuthService.CreateToken(request.Pin);
            var expiration = DateTime.UtcNow.AddMinutes(_authConfig.TokenLifetimeMinutes);

            Response.Cookies.Append("VideoViewerAuthToken", token, new CookieOptions
            {
                HttpOnly = false,
                Secure = false,
                SameSite = SameSiteMode.Strict,
                Expires = expiration,
                Path = "/"
            });

            return Ok(new AuthResponse
            {
                Token = token,
                ExpiresAt = expiration
            });
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized(new { error = "Invalid PIN" });
        }
    }
}

public class PinRequest
{
    public string Pin { get; set; } = string.Empty;
}

public class AuthResponse
{
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
}
