using System.ComponentModel.DataAnnotations;

namespace ProjectTracker.API.Models.Finance.Creditors;

/// <summary>
/// Bank balance for one paying company as at a date. The group cashflow uses the most recent
/// balance on or before the "as at" date. Kept as history so the treasurer can see how it moved.
/// </summary>
public class CreditorCashflowBalance
{
    [Key] public int Id { get; set; }
    [Required, MaxLength(10)] public string CompanyCode { get; set; } = "";
    public DateTime AsAt { get; set; }
    public decimal Balance { get; set; }
    [MaxLength(300)] public string? Note { get; set; }
    public int UpdatedByUserId { get; set; }
    [MaxLength(150)] public string? UpdatedByName { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// A standing outflow that does not go through a payment pack: a debit order (bank takes it)
/// or a monthly payment (salaries, SARS, rent, intercompany). One row per payee per company.
/// </summary>
public class CreditorCashflowLine
{
    [Key] public int Id { get; set; }
    [Required, MaxLength(10)] public string CompanyCode { get; set; } = "";
    /// <summary>DebitOrder | Monthly</summary>
    [Required, MaxLength(20)] public string Section { get; set; } = CreditorCashflowSections.DebitOrder;
    [Required, MaxLength(200)] public string Payee { get; set; } = "";
    /// <summary>Account / contract / reference the bank shows.</summary>
    [MaxLength(100)] public string? Reference { get; set; }
    [MaxLength(300)] public string? Description { get; set; }
    /// <summary>"Monthly on the 1st", "Weekly", … free text as in the spreadsheet.</summary>
    [MaxLength(60)] public string? Frequency { get; set; }
    /// <summary>Day of the month it normally goes off (1–31). Used to compute the next due date.</summary>
    public int? DueDay { get; set; }
    public decimal Amount { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    [MaxLength(150)] public string? UpdatedByName { get; set; }
}

public static class CreditorCashflowSections
{
    public const string DebitOrder = "DebitOrder";
    public const string Monthly = "Monthly";
    public static readonly string[] All = { DebitOrder, Monthly };
    public static string Title(string s) => s == Monthly ? "Monthly payments" : "Debit orders";
}
