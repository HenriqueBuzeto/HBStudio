namespace BuildingBlocks.Domain;

public static class BrazilianDocumentValidator
{
    public static bool IsValidCpf(string? cpf)
    {
        if (string.IsNullOrWhiteSpace(cpf)) return false;

        var cleanCpf = new string(cpf.Where(char.IsDigit).ToArray());
        if (cleanCpf.Length != 11) return false;

        // Rejeita sequências repetidas (ex: 11111111111)
        if (cleanCpf.Distinct().Count() == 1) return false;

        int[] multiplier1 = [10, 9, 8, 7, 6, 5, 4, 3, 2];
        int[] multiplier2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];

        string tempCpf = cleanCpf[..9];
        int sum = 0;

        for (int i = 0; i < 9; i++)
            sum += (tempCpf[i] - '0') * multiplier1[i];

        int remainder = sum % 11;
        int digit1 = remainder < 2 ? 0 : 11 - remainder;

        tempCpf += digit1;
        sum = 0;
        for (int i = 0; i < 10; i++)
            sum += (tempCpf[i] - '0') * multiplier2[i];

        remainder = sum % 11;
        int digit2 = remainder < 2 ? 0 : 11 - remainder;

        return cleanCpf.EndsWith($"{digit1}{digit2}");
    }

    public static bool IsValidCnpj(string? cnpj)
    {
        if (string.IsNullOrWhiteSpace(cnpj)) return false;

        var cleanCnpj = new string(cnpj.Where(char.IsDigit).ToArray());
        if (cleanCnpj.Length != 14) return false;

        // Rejeita sequências repetidas (ex: 00000000000000)
        if (cleanCnpj.Distinct().Count() == 1) return false;

        int[] multiplier1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        int[] multiplier2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

        string tempCnpj = cleanCnpj[..12];
        int sum = 0;

        for (int i = 0; i < 12; i++)
            sum += (tempCnpj[i] - '0') * multiplier1[i];

        int remainder = sum % 11;
        int digit1 = remainder < 2 ? 0 : 11 - remainder;

        tempCnpj += digit1;
        sum = 0;
        for (int i = 0; i < 13; i++)
            sum += (tempCnpj[i] - '0') * multiplier2[i];

        remainder = sum % 11;
        int digit2 = remainder < 2 ? 0 : 11 - remainder;

        return cleanCnpj.EndsWith($"{digit1}{digit2}");
    }
}
