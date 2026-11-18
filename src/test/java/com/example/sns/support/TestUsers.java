package com.example.sns.support;

import com.example.sns.entity.User;
import com.example.sns.repository.UserRepository;
import com.example.sns.util.JwtUtil;
import jakarta.servlet.http.Cookie;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * 테스트용 사용자와 로그인 쿠키.
 *
 * 테스트 클래스마다 같은 createUser가 복사돼 있어서, 사용자 필드나 쿠키 이름이 바뀌면 전부 고쳐야 했다.
 * 새 테스트는 이걸 주입받아 쓴다. 테스트 소스도 com.example.sns 아래라 @SpringBootTest의 컴포넌트 스캔에 잡힌다.
 * 사용자 이름은 10자 이하여야 한다(User.username 길이 제한).
 */
@Component
public class TestUsers {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public TestUsers(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    public User create(String username) {
        return create(username, User.Role.USER);
    }

    public User create(String username, User.Role role) {
        User user = new User();
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode("Test1234!"));
        user.setRole(role);
        return userRepository.save(user);
    }

    public Cookie cookie(User user) {
        return new Cookie("JWT_TOKEN",
                jwtUtil.generateToken(user.getId(), user.getUsername(), user.getRole().name()));
    }
}
