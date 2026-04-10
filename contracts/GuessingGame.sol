// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract GuessingGame {
    // --- ATTRIBUTS  ---
    address public owner;           
    address public tokenOwner;     
    uint256 public amount;          
    bytes32 public secretHash;     
    bool public isInitialised = false;
    address public dernierguesser;
    
    // --- ÉVÉNEMENTS ---
    event GameInitialized(address indexed by, uint256 initialAmount);
    event TokenGiven(address indexed from, address indexed to);
    event GuessMade(address indexed player, string guess, uint256 requested, bool success);
    event Winner(address indexed player, uint256 amountWon, string secret);
    event SecretChanged(address indexed by, bytes32 newSecretHash);

    // --- CONSTRUCTEUR ---
    constructor() {
        owner = msg.sender;
    }

    modifier onlyTokenOwner() {
        require(msg.sender == tokenOwner, "Pas ton tour !");
        _;
    }

    // --- ACTION 1: initGame() ---
    function initGame(string memory _secretClear) external payable {
        require(msg.sender == owner, "Seul owner peut initier");
        require(msg.value > 0, "Doit deposer des ETH");
        require(isInitialised == false, "Jeu deja initialise");
        
        
        
        // Convertir le secret clair en hash
        secretHash = keccak256(abi.encodePacked(_secretClear));
        
        amount = msg.value;
        isInitialised = true;
        
        
        emit GameInitialized(msg.sender, msg.value);
    }

    // --- ACTION 2: giveToken() ---
    function giveToken(address _nextPlayer) external {
        require(msg.sender == owner || msg.sender == tokenOwner, "Pas autorise");
        require(_nextPlayer != address(0), "Adresse invalide");
        require(_nextPlayer != tokenOwner, "Deja token owner");
        require(isInitialised == true);
        
        address oldOwner = tokenOwner;
        tokenOwner = _nextPlayer;
        
        emit TokenGiven(oldOwner, _nextPlayer);
    }

    // --- ACTION 3: guess() ---
    function guess(string memory _secretClear, uint256 _requestedAmount, string memory _newSecretClear) external onlyTokenOwner {
        require(_requestedAmount > 0, "Montant > 0");
        require(_requestedAmount <= amount, "Pas assez de fonds");
        require(dernierguesser != msg.sender, "Vous avez deja joue !");
        require(isInitialised == true);

        
        bytes32 guessHash = keccak256(abi.encodePacked(_secretClear));
        bool isCorrect = (guessHash == secretHash);
        dernierguesser = msg.sender;
        
        emit GuessMade(msg.sender, _secretClear, _requestedAmount, isCorrect);
        
        if (isCorrect) {
            uint256 winAmount = _requestedAmount;
            
            amount -= winAmount;
            
            (bool sent, ) = payable(msg.sender).call{value: winAmount}("");
            require(sent, "Echec transfert");
            
            emit Winner(msg.sender, winAmount, _secretClear);
            
            // Si plus de fonds, fin du jeu
            if (amount == 0) {
                tokenOwner = address(0);
            }

            secretHash = keccak256(abi.encodePacked(_newSecretClear));
            emit SecretChanged(tokenOwner, secretHash);
            
        }

    }

    function getBalance() external view returns (uint256) {
        require(isInitialised == true);
        return address(this).balance;
    }
    

}