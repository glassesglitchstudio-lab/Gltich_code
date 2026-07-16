#include "UDamageSystem.h"
#include "Kismet/GameplayStatics.h"
#include "GameFramework/Character.h"
#include "GameFramework/CharacterMovementComponent.h"

UDamageSystem::UDamageSystem()
{
    PrimaryComponentTick.bCanEverTick = true;
}

void UDamageSystem::BeginPlay()
{
    Super::BeginPlay();
}

void UDamageSystem::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    if (bDoTActive)
    {
        TickDoT(DeltaTime);
    }
}

float UDamageSystem::DealDamage(AActor* Target, float BaseDamage, const FString& DamageType)
{
    if (!Target || BaseDamage <= 0.0f) return 0.0f;

    float FinalDamage = CalculateFinalDamage(BaseDamage, DamageType);

    // Use UE5's standard damage pipeline — triggers ApplyDamage on target
    UGameplayStatics::ApplyDamage(
        Target,
        FinalDamage,
        GetOwner()->GetInstigatorController(),
        GetOwner(),
        UDamageType::StaticClass()
    );

    OnDamageDealt.Broadcast(FinalDamage, GetOwner(), DamageType);

    // Apply knockback impulse for characters
    ACharacter* TargetCharacter = Cast<ACharacter>(Target);
    if (TargetCharacter)
    {
        UCharacterMovementComponent* Movement = TargetCharacter->GetCharacterMovement();
        if (Movement)
        {
            FVector KnockbackDir = (Target->GetActorLocation() - GetOwner()->GetActorLocation()).GetSafeNormal();
            Movement->Launch(KnockbackDir * FinalDamage * 0.5f);
        }
    }

    return FinalDamage;
}

float UDamageSystem::DealDamageWithOrigin(AActor* Target, float BaseDamage, const FVector& HitLocation, const FVector& HitDirection, const FString& DamageType)
{
    if (!Target || BaseDamage <= 0.0f) return 0.0f;

    float FinalDamage = CalculateFinalDamage(BaseDamage, DamageType);

    // Create a point damage event with full hit info
    FPointDamageEvent DamageEvent;
    DamageEvent.Damage = FinalDamage;
    DamageEvent.HitInfo.Location = HitLocation;
    DamageEvent.HitInfo.ImpactNormal = HitDirection;
    DamageEvent.ShotDirection = HitDirection;
    DamageEvent.DamageTypeClass = UDamageType::StaticClass();

    AActor* Owner = GetOwner();
    if (Owner)
    {
        Target->TakeDamage(
            FinalDamage,
            DamageEvent,
            Owner->GetInstigatorController(),
            Owner
        );
    }

    OnDamageDealt.Broadcast(FinalDamage, Owner, DamageType);

    // Apply directional impulse
    ACharacter* TargetCharacter = Cast<ACharacter>(Target);
    if (TargetCharacter)
    {
        UCharacterMovementComponent* Movement = TargetCharacter->GetCharacterMovement();
        if (Movement)
        {
            Movement->Launch(HitDirection.GetSafeNormal() * FinalDamage * 0.5f);
        }
    }

    return FinalDamage;
}

void UDamageSystem::ApplyAoE(const FVector& Origin, float InnerRadius, float OuterRadius, float MaxDamage, float MinDamage, AActor* Instigator)
{
    if (InnerRadius > OuterRadius) return;

    // Use UE5's radial damage with falloff — respects damage type, ignores friendly, etc.
    UGameplayStatics::ApplyRadialDamageWithFalloff(
        GetOwner(),
        MaxDamage,
        MinDamage,
        Origin,
        InnerRadius,
        OuterRadius,
        0.0f, // DamageFalloffExponent
        UDamageType::StaticClass(),
        TArray<AActor*>(),
        GetOwner(),
        GetOwner()->GetInstigatorController()
    );
}

void UDamageSystem::ApplyDoT(AActor* Target, float DamagePerTick, float TickInterval, float TotalDuration, const FString& DamageType)
{
    if (!Target || DamagePerTick <= 0.0f || TotalDuration <= 0.0f) return;

    DoTTarget = Target;
    DoTDamagePerTick = DamagePerTick;
    DoTTickInterval = FMath::Max(0.1f, TickInterval);
    DoTTimeRemaining = TotalDuration;
    DoTTickTimer = 0.0f;
    DoTDamageType = DamageType;
    bDoTActive = true;
}

void UDamageSystem::CancelDoT()
{
    bDoTActive = false;
    DoTTarget = nullptr;
    DoTTimeRemaining = 0.0f;
    DoTTickTimer = 0.0f;
}

void UDamageSystem::SetDefense(float Defense)
{
    DefenseValue = FMath::Clamp(Defense, 0.0f, 0.9f); // 0-90% damage reduction
    OnDefenseChanged.Broadcast(DefenseValue);
}

void UDamageSystem::SetVulnerability(float Multiplier)
{
    VulnerabilityMultiplier = FMath::Max(0.0f, Multiplier); // >1.0 = more damage
}

void UDamageSystem::SetResistance(const FString& DamageType, float ResistanceValue)
{
    // Resistance: 0.0 = no resistance, 1.0 = immune
    Resistances.Add(DamageType, FMath::Clamp(ResistanceValue, 0.0f, 1.0f));
}

float UDamageSystem::GetResistance(const FString& DamageType) const
{
    const float* Found = Resistances.Find(DamageType);
    return Found ? *Found : 0.0f;
}

void UDamageSystem::ClearResistance(const FString& DamageType)
{
    Resistances.Remove(DamageType);
}

void UDamageSystem::ClearAllResistances()
{
    Resistances.Empty();
}

float UDamageSystem::CalculateFinalDamage(float BaseDamage, const FString& DamageType) const
{
    float FinalDamage = BaseDamage;

    // Apply defense reduction
    FinalDamage *= (1.0f - DefenseValue);

    // Apply vulnerability multiplier
    FinalDamage *= VulnerabilityMultiplier;

    // Apply type-specific resistance
    const float* Resistance = Resistances.Find(DamageType);
    if (Resistance)
    {
        FinalDamage *= (1.0f - *Resistance);
    }

    return FMath::Max(0.0f, FinalDamage);
}

void UDamageSystem::TickDoT(float DeltaTime)
{
    if (!bDoTActive || !DoTTarget) return;

    DoTTimeRemaining -= DeltaTime;
    DoTTickTimer += DeltaTime;

    if (DoTTickTimer >= DoTTickInterval)
    {
        DoTTickTimer -= DoTTickInterval;

        // Apply damage through the standard pipeline
        UGameplayStatics::ApplyDamage(
            DoTTarget,
            DoTDamagePerTick,
            GetOwner()->GetInstigatorController(),
            GetOwner(),
            UDamageType::StaticClass()
        );

        OnDamageDealt.Broadcast(DoTDamagePerTick, GetOwner(), DoTDamageType);
    }

    if (DoTTimeRemaining <= 0.0f)
    {
        bDoTActive = false;
        DoTTarget = nullptr;
    }
}
