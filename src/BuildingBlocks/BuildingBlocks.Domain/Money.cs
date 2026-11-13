namespace BuildingBlocks.Domain;

public record Money
{
    public decimal Amount { get; init; }
    public string Currency { get; init; }

    public Money() : this(0m, "BRL") { }

    public Money(decimal amount, string currency = "BRL")
    {
        if (string.IsNullOrWhiteSpace(currency))
            throw new ArgumentException("Moeda não pode ser vazia.", nameof(currency));

        Amount = decimal.Round(amount, 2, MidpointRounding.AwayFromZero);
        Currency = currency.ToUpperInvariant();
    }

    public static Money FromDecimal(decimal amount, string currency = "BRL") => new(amount, currency);
    public static Money Zero(string currency = "BRL") => new(0m, currency);

    public static Money operator +(Money a, Money b)
    {
        EnsureSameCurrency(a, b);
        return new Money(a.Amount + b.Amount, a.Currency);
    }

    public static Money operator -(Money a, Money b)
    {
        EnsureSameCurrency(a, b);
        return new Money(a.Amount - b.Amount, a.Currency);
    }

    private static void EnsureSameCurrency(Money a, Money b)
    {
        if (a.Currency != b.Currency)
            throw new InvalidOperationException($"Não é possível operar moedas distintas: {a.Currency} vs {b.Currency}");
    }
}
